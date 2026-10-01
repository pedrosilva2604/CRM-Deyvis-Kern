import { api } from '@/lib/api';
import type {
  CompleteProfilesIndicator,
  InvalidOrRejectedContactsIndicator,
  LeadImportProgress,
  LeadImportReceipt,
  LeadFilterOptions,
  LeadListFilters,
  LeadListItem,
  LeadListPage,
  NewLeadsIndicator,
  TotalLeadsIndicator,
  UnassignedLeadsIndicator,
} from '@/types/lead';

export const LEADS_PAGE_SIZE = 20;
const CSV_CONTENT_TYPE = 'text/csv; charset=utf-8';

function buildLeadListQueryParams(filters: LeadListFilters) {
  const queryParams: Record<string, string | number> = { page: filters.page, pageSize: LEADS_PAGE_SIZE };
  if (filters.search.trim()) queryParams.search = filters.search.trim();
  if (filters.stageId) queryParams.stageId = filters.stageId;
  if (filters.source) queryParams.source = filters.source;
  if (filters.assignment) queryParams.assignment = filters.assignment;
  if (filters.contactStatus) queryParams.contactStatus = filters.contactStatus;
  return queryParams;
}

export const leadsApi = {
  async listLeads(filters: LeadListFilters): Promise<LeadListPage> {
    const response = await api.get<LeadListPage>('/leads', { params: buildLeadListQueryParams(filters) });
    return response.data;
  },

  async getTotalLeads(): Promise<TotalLeadsIndicator> {
    const response = await api.get<TotalLeadsIndicator>('/leads/indicators/total-leads');
    return response.data;
  },

  async getNewLeadsInLastSevenDays(): Promise<NewLeadsIndicator> {
    const response = await api.get<NewLeadsIndicator>('/leads/indicators/new-leads');
    return response.data;
  },

  async getUnassignedLeads(): Promise<UnassignedLeadsIndicator> {
    const response = await api.get<UnassignedLeadsIndicator>('/leads/indicators/unassigned-leads');
    return response.data;
  },

  async getInvalidOrRejectedContacts(): Promise<InvalidOrRejectedContactsIndicator> {
    const response = await api.get<InvalidOrRejectedContactsIndicator>('/leads/indicators/invalid-or-rejected-contacts');
    return response.data;
  },

  async getCompleteProfiles(): Promise<CompleteProfilesIndicator> {
    const response = await api.get<CompleteProfilesIndicator>('/leads/indicators/complete-profiles');
    return response.data;
  },

  async getLeadFilterOptions(): Promise<LeadFilterOptions> {
    const response = await api.get<LeadFilterOptions>('/leads/filter-options');
    return response.data;
  },

  async getLeadDetails(leadId: string): Promise<LeadListItem> {
    const response = await api.get<LeadListItem>(`/leads/${leadId}`);
    return response.data;
  },

  async requestLeadImport(csvText: string): Promise<LeadImportReceipt> {
    const response = await api.post<LeadImportReceipt>('/leads/imports', csvText, {
      headers: { 'Content-Type': CSV_CONTENT_TYPE },
    });
    return response.data;
  },

  async getLeadImportProgress(importId: string): Promise<LeadImportProgress> {
    const response = await api.get<LeadImportProgress>(`/leads/imports/${importId}`);
    return response.data;
  },

  async retryLeadImport(importId: string): Promise<void> {
    await api.post(`/leads/imports/${importId}/retry`);
  },
};
