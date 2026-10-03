import { Prisma } from '@prisma/client';
import {
  DELETED_LEAD_NAME,
  leadOutputRelations,
  notDeletedLeads,
  toLeadOutput,
  UNASSIGNED_LEADS_FILTER,
  type ContactInUse,
  type CreateLeadData,
  type LeadContact,
  type LeadErasure,
  type LeadListPage,
  type LeadListQuery,
  type LeadOutput,
  type LeadSearch,
  type LeadWithRelations,
  type UpdateLeadData,
} from '@/models/lead.model';
import type { DatabaseClient } from '@/repositories/database-client';


export interface ILeadRepository {
  findLeadsPage(listQuery: LeadListQuery): Promise<LeadListPage>;
  findLeadById(leadId: string): Promise<LeadOutput | null>;
  findSourcesInUse(): Promise<string[]>;
  createLead(newLead: CreateLeadData): Promise<LeadOutput>;
  updateLead(leadId: string, leadChanges: UpdateLeadData): Promise<void>;
  eraseLead(erasure: LeadErasure): Promise<void>;
  findContactInUse(contact: LeadContact, ignoredLeadId: string | null): Promise<ContactInUse | null>;
}

function buildSearchCondition(search: LeadSearch): Prisma.Sql {
  if (search.searchedBy === 'phone') return Prisma.sql`"phone" = ${search.internationalPhone}`;
  return Prisma.sql`"searchVector" @@ plainto_tsquery('simple', immutable_unaccent(${search.words}))`;
}

function buildAssignmentCondition(assignment: string): Prisma.Sql {
  if (assignment === UNASSIGNED_LEADS_FILTER) return Prisma.sql`"assignedToId" IS NULL`;
  return Prisma.sql`"assignedToId" = ${assignment}::uuid`;
}

function buildListCondition(listQuery: LeadListQuery): Prisma.Sql {
  const conditions = [Prisma.sql`"deletedAt" IS NULL`];
  if (listQuery.search) conditions.push(buildSearchCondition(listQuery.search));
  if (listQuery.source) conditions.push(Prisma.sql`"source" = ${listQuery.source}`);
  if (listQuery.assignment) conditions.push(buildAssignmentCondition(listQuery.assignment));
  if (listQuery.contactStatus) {
    conditions.push(Prisma.sql`"contactStatus" = ${listQuery.contactStatus}::"LeadContactStatus"`);
  }
  return Prisma.join(conditions, ' AND ');
}

function keepPageOrder(pageLeadIds: string[], pageLeads: LeadWithRelations[]): LeadWithRelations[] {
  const leadById = new Map(pageLeads.map((lead) => [lead.id, lead]));
  return pageLeadIds.flatMap((leadId) => leadById.get(leadId) ?? []);
}

export class LeadRepository implements ILeadRepository {
  constructor(private readonly prisma: DatabaseClient) {}

  async findLeadsPage(listQuery: LeadListQuery): Promise<LeadListPage> {
    const listCondition = buildListCondition(listQuery);
    const [pageLeadIds, totalMatchingLeads] = await Promise.all([
      this.findPageLeadIds(listCondition, listQuery),
      this.countMatchingLeads(listCondition),
    ]);
    return {
      leads: await this.findLeadsInPageOrder(pageLeadIds),
      totalMatchingLeads,
      page: listQuery.page,
      pageSize: listQuery.pageSize,
    };
  }

  async findLeadById(leadId: string): Promise<LeadOutput | null> {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, ...notDeletedLeads },
      include: leadOutputRelations,
    });
    return lead ? toLeadOutput(lead) : null;
  }

  async findSourcesInUse(): Promise<string[]> {
    const sources = await this.prisma.lead.findMany({
      where: { ...notDeletedLeads, source: { not: null } },
      distinct: ['source'],
      select: { source: true },
      orderBy: { source: 'asc' },
    });
    return sources.flatMap(({ source }) => (source === null ? [] : [source]));
  }

  async createLead(newLead: CreateLeadData): Promise<LeadOutput> {
    const createdLead = await this.prisma.lead.create({ data: newLead, include: leadOutputRelations });
    return toLeadOutput(createdLead);
  }

  async updateLead(leadId: string, leadChanges: UpdateLeadData): Promise<void> {
    await this.prisma.lead.update({ where: { id: leadId }, data: leadChanges, select: { id: true } });
  }

  async eraseLead({ leadId, deletedAt, deletedById }: LeadErasure): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.lead.update({
        where: { id: leadId },
        data: {
          name: DELETED_LEAD_NAME,
          phone: null,
          phoneCountry: null,
          email: null,
          source: null,
          tags: [],
          value: null,
          assignedToId: null,
          deletedAt,
          deletedById,
        },
        select: { id: true },
      });
      await transaction.pipelineCard.deleteMany({ where: { leadId } });
    });
  }

  async findContactInUse({ phone, email }: LeadContact, ignoredLeadId: string | null): Promise<ContactInUse | null> {
    const contactMatches: Prisma.LeadWhereInput[] = [];
    if (phone) contactMatches.push({ phone });
    if (email) contactMatches.push({ email });
    if (contactMatches.length === 0) return null;

    const leadsHoldingContact = await this.prisma.lead.findMany({
      where: { OR: contactMatches, ...(ignoredLeadId !== null && { id: { not: ignoredLeadId } }) },
      select: { phone: true },
    });
    if (leadsHoldingContact.length === 0) return null;
    return leadsHoldingContact.some((lead) => lead.phone === phone) ? 'phone' : 'email';
  }

  private async findPageLeadIds(listCondition: Prisma.Sql, listQuery: LeadListQuery): Promise<string[]> {
    const skippedLeads = (listQuery.page - 1) * listQuery.pageSize;
    const pageRows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Lead" WHERE ${listCondition}
      ORDER BY "createdAt" DESC, "id" ASC
      LIMIT ${listQuery.pageSize} OFFSET ${skippedLeads}`;
    return pageRows.map(({ id }) => id);
  }

  private async countMatchingLeads(listCondition: Prisma.Sql): Promise<number> {
    const [countRow] = await this.prisma.$queryRaw<{ totalMatchingLeads: bigint }[]>`
      SELECT COUNT(*) AS "totalMatchingLeads" FROM "Lead" WHERE ${listCondition}`;
    return Number(countRow?.totalMatchingLeads ?? 0);
  }

  private async findLeadsInPageOrder(pageLeadIds: string[]): Promise<LeadOutput[]> {
    const pageLeads = await this.prisma.lead.findMany({
      where: { id: { in: pageLeadIds } },
      include: leadOutputRelations,
    });
    return keepPageOrder(pageLeadIds, pageLeads).map(toLeadOutput);
  }
}
