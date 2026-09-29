import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '@/api/leadsApi';
import type { ImportLeadsRequest, LeadListFilters } from '@/types/lead';

const LEADS_QUERY_KEY = ['leads'] as const;
const FILTER_OPTIONS_REUSED_FOR_MS = 5 * 60_000;

export function useLeadList(filters: LeadListFilters) {
  return useQuery({
    queryKey: [...LEADS_QUERY_KEY, 'list', filters],
    queryFn: () => leadsApi.listLeads(filters),
    placeholderData: keepPreviousData,
  });
}

export function useLeadBaseIndicators() {
  return useQuery({
    queryKey: [...LEADS_QUERY_KEY, 'indicators'],
    queryFn: () => leadsApi.getLeadBaseIndicators(),
  });
}

export function useLeadFilterOptions() {
  return useQuery({
    queryKey: [...LEADS_QUERY_KEY, 'filter-options'],
    queryFn: () => leadsApi.getLeadFilterOptions(),
    staleTime: FILTER_OPTIONS_REUSED_FOR_MS,
  });
}

export function useLeadDetails(leadId: string | null) {
  return useQuery({
    queryKey: [...LEADS_QUERY_KEY, 'details', leadId],
    queryFn: () => leadsApi.getLeadDetails(leadId as string),
    enabled: leadId !== null,
  });
}

export function useImportLeads() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (importLeadsRequest: ImportLeadsRequest) => leadsApi.importLeads(importLeadsRequest),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LEADS_QUERY_KEY }),
  });
}
