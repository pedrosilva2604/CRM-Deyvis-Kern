import { api } from '@/lib/api';
import type {
  ImportLeadsRequest,
  ImportLeadsResult,
  LeadBaseIndicators,
  LeadFilterOptions,
  LeadListFilters,
  LeadListItem,
  LeadListPage,
} from '@/types/lead';

export const LEADS_PAGE_SIZE = 20;

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

  async getLeadBaseIndicators(): Promise<LeadBaseIndicators> {
    const response = await api.get<LeadBaseIndicators>('/leads/indicators');
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

  async importLeads(importLeadsRequest: ImportLeadsRequest): Promise<ImportLeadsResult> {
    const response = await api.post<ImportLeadsResult>('/leads/import', importLeadsRequest);
    return response.data;
  },
};
