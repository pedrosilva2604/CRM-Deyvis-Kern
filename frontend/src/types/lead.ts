export type LeadContactStatus = 'VALID' | 'INVALID' | 'SPAM';

export const CONTACT_STATUS_LABELS: Record<LeadContactStatus, string> = {
  VALID: 'Válido',
  INVALID: 'Inválido',
  SPAM: 'Spam / falso',
};

export const UNASSIGNED_LEADS_FILTER = 'unassigned';

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
  addedToPipelineLeads: number;
  alreadyInPipelineLeads: number;
  importsIntoPipeline: boolean;
  createdAt: string;
  finishedAt: string | null;
}
