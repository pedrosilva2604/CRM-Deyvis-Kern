import type { LeadContactStatus, Prisma } from '@prisma/client';

export const UNASSIGNED_LEADS_FILTER = 'unassigned';

export interface LeadStageOutput {
  id: string;
  name: string;
  color: string;
  isWon: boolean;
  isLost: boolean;
}

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
  pipeline: LeadPersonOutput;
  stage: LeadStageOutput;
  assignedTo: LeadPersonOutput | null;
  unreadCount: number;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadListFilters {
  search?: string;
  stageId?: string;
  source?: string;
  assignment?: string;
  contactStatus?: LeadContactStatus;
  page: number;
  pageSize: number;
}

export interface LeadListPage {
  leads: LeadOutput[];
  totalMatchingLeads: number;
  page: number;
  pageSize: number;
}

export interface LeadBaseIndicators {
  totalLeads: number;
  newLeadsInLastSevenDays: number;
  unassignedLeads: number;
  invalidOrRejectedContacts: number;
  completeProfiles: number;
}

export interface LeadPipelineOption {
  id: string;
  name: string;
  stages: LeadStageOutput[];
}

export interface LeadFilterOptions {
  pipelines: LeadPipelineOption[];
  sources: string[];
  assignees: LeadPersonOutput[];
}

export interface CreateLeadInput {
  name: string;
  phone: string;
  email: string | null;
  enteredOn: string | null;
  stageId: string;
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
  stageId?: string;
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
  pipelineId: string;
  stageId: string;
  assignedToId: string | null;
}

export type UpdateLeadData = Partial<Omit<CreateLeadData, 'pipelineId'>> & {
  pipelineId?: string;
  contactStatus?: LeadContactStatus;
};

export const leadOutputRelations = {
  pipeline: { select: { id: true, name: true } },
  stage: { select: { id: true, name: true, color: true, isWon: true, isLost: true } },
  assignedTo: { select: { id: true, name: true } },
} satisfies Prisma.LeadInclude;

export type LeadWithRelations = Prisma.LeadGetPayload<{ include: typeof leadOutputRelations }>;

export function toLeadOutput(lead: LeadWithRelations): LeadOutput {
  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    phoneCountry: lead.phoneCountry,
    email: lead.email,
    source: lead.source,
    tags: lead.tags,
    value: lead.value === null ? null : lead.value.toFixed(2),
    contactStatus: lead.contactStatus,
    enteredOn: lead.enteredOn.toISOString().slice(0, 10),
    pipeline: lead.pipeline,
    stage: lead.stage,
    assignedTo: lead.assignedTo,
    unreadCount: lead.unreadCount,
    lastMessageAt: lead.lastMessageAt,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  };
}
