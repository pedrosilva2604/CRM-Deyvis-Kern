export type LeadContactStatus = 'VALID' | 'INVALID' | 'SPAM';

export const CONTACT_STATUS_LABELS: Record<LeadContactStatus, string> = {
  VALID: 'Válido',
  INVALID: 'Inválido',
  SPAM: 'Spam / falso',
};

export const UNASSIGNED_LEADS_FILTER = 'unassigned';

export interface LeadStage {
  id: string;
  name: string;
  color: string;
  isWon: boolean;
  isLost: boolean;
}

export interface LeadPipeline {
  id: string;
  name: string;
  stages: LeadStage[];
}

export interface LeadAssignee {
  id: string;
  name: string;
}

export interface LeadListItem {
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
  pipeline: { id: string; name: string };
  stage: LeadStage;
  assignedTo: LeadAssignee | null;
  unreadCount: number;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadListPage {
  leads: LeadListItem[];
  totalMatchingLeads: number;
  page: number;
  pageSize: number;
}

export interface LeadListFilters {
  search: string;
  stageId: string;
  source: string;
  assignment: string;
  contactStatus: LeadContactStatus | '';
  page: number;
}

export interface LeadBaseIndicators {
  totalLeads: number;
  newLeadsInLastSevenDays: number;
  unassignedLeads: number;
  invalidOrRejectedContacts: number;
  completeProfiles: number;
}

export interface LeadFilterOptions {
  pipelines: LeadPipeline[];
  sources: string[];
  assignees: LeadAssignee[];
}

export interface LeadToImport {
  name: string;
  phone: string;
  email: string | null;
  source: string | null;
  tags: string[];
  value: string | null;
}

export interface ImportLeadsRequest {
  pipelineId: string;
  stageId: string;
  leads: LeadToImport[];
}

export interface ImportLeadsResult {
  importedLeads: number;
  skippedDuplicateLeads: number;
}
