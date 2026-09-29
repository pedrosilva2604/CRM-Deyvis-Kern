import { LeadContactStatus, Prisma, type PrismaClient } from '@prisma/client';
import { ConflictError } from '@/errors/app-errors';
import { LEAD_ERRORS } from '@/errors/errors.constants';
import {
  leadOutputRelations,
  toLeadOutput,
  UNASSIGNED_LEADS_FILTER,
  type CreateLeadData,
  type LeadBaseIndicators,
  type LeadListFilters,
  type LeadListPage,
  type LeadOutput,
  type UpdateLeadData,
} from '@/models/lead.model';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';
const MINIMUM_DIGITS_FOR_PHONE_SEARCH = 4;

export interface ILeadRepository {
  findLeadsPage(filters: LeadListFilters): Promise<LeadListPage>;
  findLeadById(leadId: string): Promise<LeadOutput | null>;
  countLeadBaseIndicators(newLeadsSince: Date): Promise<LeadBaseIndicators>;
  findSourcesInUse(): Promise<string[]>;
  createLead(newLead: CreateLeadData): Promise<LeadOutput>;
  updateLead(leadId: string, leadChanges: UpdateLeadData): Promise<void>;
  softDeleteLead(leadId: string, deletedAt: Date): Promise<void>;
}

const notDeleted = { deletedAt: null } satisfies Prisma.LeadWhereInput;

function buildSearchCondition(search: string): Prisma.LeadWhereInput {
  const searchDigits = search.replace(/\D/g, '');
  const conditions: Prisma.LeadWhereInput[] = [
    { name: { contains: search, mode: 'insensitive' } },
    { email: { contains: search, mode: 'insensitive' } },
  ];
  if (searchDigits.length >= MINIMUM_DIGITS_FOR_PHONE_SEARCH) conditions.push({ phone: { contains: searchDigits } });
  return { OR: conditions };
}

function buildAssignmentCondition(assignment: string): Prisma.LeadWhereInput {
  return assignment === UNASSIGNED_LEADS_FILTER ? { assignedToId: null } : { assignedToId: assignment };
}

function buildListCondition(filters: LeadListFilters): Prisma.LeadWhereInput {
  return {
    ...notDeleted,
    ...(filters.search && buildSearchCondition(filters.search)),
    ...(filters.stageId && { stageId: filters.stageId }),
    ...(filters.source && { source: filters.source }),
    ...(filters.assignment && buildAssignmentCondition(filters.assignment)),
    ...(filters.contactStatus && { contactStatus: filters.contactStatus }),
  };
}

function translateUniqueViolation(error: unknown): never {
  const isUniqueViolation =
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_CONSTRAINT_VIOLATION;
  if (!isUniqueViolation) throw error;
  const violatedColumns = String((error.meta?.target as string[] | string | undefined) ?? '');
  throw new ConflictError(violatedColumns.includes('email') ? LEAD_ERRORS.EMAIL_IN_USE : LEAD_ERRORS.PHONE_IN_USE);
}

export class LeadRepository implements ILeadRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findLeadsPage(filters: LeadListFilters): Promise<LeadListPage> {
    const listCondition = buildListCondition(filters);
    const [matchingLeads, totalMatchingLeads] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where: listCondition,
        include: leadOutputRelations,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.prisma.lead.count({ where: listCondition }),
    ]);
    return { leads: matchingLeads.map(toLeadOutput), totalMatchingLeads, page: filters.page, pageSize: filters.pageSize };
  }

  async findLeadById(leadId: string): Promise<LeadOutput | null> {
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, ...notDeleted }, include: leadOutputRelations });
    return lead ? toLeadOutput(lead) : null;
  }

  async countLeadBaseIndicators(newLeadsSince: Date): Promise<LeadBaseIndicators> {
    const [totalLeads, newLeadsInLastSevenDays, unassignedLeads, invalidOrRejectedContacts, completeProfiles] =
      await this.prisma.$transaction([
        this.prisma.lead.count({ where: notDeleted }),
        this.prisma.lead.count({ where: { ...notDeleted, enteredOn: { gte: newLeadsSince } } }),
        this.prisma.lead.count({ where: { ...notDeleted, assignedToId: null } }),
        this.prisma.lead.count({ where: { ...notDeleted, contactStatus: { not: LeadContactStatus.VALID } } }),
        this.prisma.lead.count({ where: { ...notDeleted, email: { not: null } } }),
      ]);
    return { totalLeads, newLeadsInLastSevenDays, unassignedLeads, invalidOrRejectedContacts, completeProfiles };
  }

  async findSourcesInUse(): Promise<string[]> {
    const sources = await this.prisma.lead.findMany({
      where: { ...notDeleted, source: { not: null } },
      distinct: ['source'],
      select: { source: true },
      orderBy: { source: 'asc' },
    });
    return sources.flatMap(({ source }) => (source === null ? [] : [source]));
  }

  async createLead(newLead: CreateLeadData): Promise<LeadOutput> {
    try {
      const createdLead = await this.prisma.lead.create({ data: newLead, include: leadOutputRelations });
      return toLeadOutput(createdLead);
    } catch (error) {
      return translateUniqueViolation(error);
    }
  }

  async updateLead(leadId: string, leadChanges: UpdateLeadData): Promise<void> {
    try {
      await this.prisma.lead.update({ where: { id: leadId }, data: leadChanges, select: { id: true } });
    } catch (error) {
      translateUniqueViolation(error);
    }
  }

  async softDeleteLead(leadId: string, deletedAt: Date): Promise<void> {
    await this.prisma.lead.update({ where: { id: leadId }, data: { deletedAt } });
  }
}
