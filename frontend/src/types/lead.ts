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

export interface TotalLeadsIndicator {
  totalLeads: number;
}

export interface NewLeadsIndicator {
  newLeadsInLastSevenDays: number;
}

export interface UnassignedLeadsIndicator {
  unassignedLeads: number;
  shareOfBase: number;
}

export interface InvalidOrRejectedContactsIndicator {
  invalidOrRejectedContacts: number;
  shareOfBase: number;
}

export interface CompleteProfilesIndicator {
  completeProfiles: number;
  shareOfBase: number;
}

export interface LeadFilterOptions {
  pipelines: LeadPipeline[];
  sources: string[];
  assignees: LeadAssignee[];
}

export interface LeadImportReceipt {
  message: string;
  importId: string;
}

export type LeadImportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';

export interface LeadImportProgress {
  status: LeadImportStatus;
  totalRows: number;
  invalidRows: number;
  duplicateRowsInFile: number;
  rowsToImport: number;
  processedRows: number;
  importedLeads: number;
  skippedExistingLeads: number;
  restoredLeads: number;
  skippedDeletedLeads: number;
  createdAt: string;
  finishedAt: string | null;
}
