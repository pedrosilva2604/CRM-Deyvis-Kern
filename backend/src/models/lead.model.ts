import type { LeadContactStatus, Prisma } from '@prisma/client';

export const UNASSIGNED_LEADS_FILTER = 'unassigned';

export interface LeadPersonOutput {
  id: string;
  name: string;
}

export interface LeadOutput {
  id: string;
  name: string;
  phone: string;
  phoneCountry: string | null;
  email: string | null;
  source: string | null;
  tags: string[];
  value: string | null;
  contactStatus: LeadContactStatus;
  enteredOn: string;
  assignedTo: LeadPersonOutput | null;
  unreadCount: number;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadListFilters {
  search?: string;
  source?: string;
  assignment?: string;
  contactStatus?: LeadContactStatus;
  page: number;
  pageSize: number;
}

export type LeadSearch =
  | { searchedBy: 'phone'; internationalPhone: string }
  | { searchedBy: 'words'; words: string };

export interface LeadListQuery extends Omit<LeadListFilters, 'search'> {
  search?: LeadSearch;
}

export interface LeadListPage {
  leads: LeadOutput[];
  totalMatchingLeads: number;
  page: number;
  pageSize: number;
}

export interface LeadFilterOptions {
  sources: string[];
  assignees: LeadPersonOutput[];
}

export interface CreateLeadInput {
  name: string;
  phone: string;
  email: string | null;
  enteredOn: string | null;
  source: string | null;
  tags: string[];
  value: string | null;
  assignedToId: string | null;
}

export interface UpdateLeadInput {
  name?: string;
  phone?: string;
  email?: string | null;
  enteredOn?: string;
  source?: string | null;
  tags?: string[];
  value?: string | null;
  assignedToId?: string | null;
  contactStatus?: LeadContactStatus;
}

export type LeadIdParams = {
  leadId: string;
};

export interface LeadDetailsRequest {
  targetLeadId: string;
}

export interface UpdateLeadRequest {
  targetLeadId: string;
  leadChanges: UpdateLeadInput;
}

export type UpdatableLeadField = keyof UpdateLeadInput;

export interface LeadUpdateResult {
  updatedFields: UpdatableLeadField[];
}

export interface DeleteLeadRequest {
  targetLeadId: string;
}

export interface CreateLeadData {
  name: string;
  phone: string;
  phoneCountry: string | null;
  email: string | null;
  source: string | null;
  tags: string[];
  value: string | null;
  enteredOn: Date;
  assignedToId: string | null;
}

export type UpdateLeadData = Partial<CreateLeadData> & {
  contactStatus?: LeadContactStatus;
};

export interface LeadContact {
  phone?: string;
  email?: string | null;
}

export type ContactInUse = 'phone' | 'email';

export interface LeadErasure {
  leadId: string;
  deletedAt: Date;
  deletedById: string;
}

export const DELETED_LEAD_NAME = 'Lead excluído';

export const notDeletedLeads = { deletedAt: null } satisfies Prisma.LeadWhereInput;

export const leadOutputRelations = {
  assignedTo: { select: { id: true, name: true } },
} satisfies Prisma.LeadInclude;

export type LeadWithRelations = Prisma.LeadGetPayload<{ include: typeof leadOutputRelations }>;

export function phoneOfActiveLead({ id, phone }: { id: string; phone: string | null }): string {
  if (phone === null) throw new Error(`O lead ${id} foi excluído e não tem telefone`);
  return phone;
}

export function toLeadOutput(lead: LeadWithRelations): LeadOutput {
  return {
    id: lead.id,
    name: lead.name,
    phone: phoneOfActiveLead(lead),
    phoneCountry: lead.phoneCountry,
    email: lead.email,
    source: lead.source,
    tags: lead.tags,
    value: lead.value === null ? null : lead.value.toFixed(2),
    contactStatus: lead.contactStatus,
    enteredOn: lead.enteredOn.toISOString().slice(0, 10),
    assignedTo: lead.assignedTo,
    unreadCount: lead.unreadCount,
    lastMessageAt: lead.lastMessageAt,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  };
}
