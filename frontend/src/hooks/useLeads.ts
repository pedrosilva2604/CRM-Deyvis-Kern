import { useEffect } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '@/api/leadsApi';
import type { LeadImportProgress, LeadImportStatus, LeadListFilters } from '@/types/lead';

const LEADS_QUERY_KEY = ['leads'] as const;
const LEAD_IMPORT_PROGRESS_CHECK_EVERY_MS = 2_000;
const RUNNING_LEAD_IMPORT_STATUSES: LeadImportStatus[] = ['PENDING', 'PROCESSING'];
const LEAD_INDICATORS_QUERY_KEY = [...LEADS_QUERY_KEY, 'indicators'] as const;
const FILTER_OPTIONS_REUSED_FOR_MS = 5 * 60_000;

export function useLeadList(filters: LeadListFilters) {
  return useQuery({
    queryKey: [...LEADS_QUERY_KEY, 'list', filters],
    queryFn: () => leadsApi.listLeads(filters),
    placeholderData: keepPreviousData,
  });
}

export function useTotalLeads() {
  return useQuery({
    queryKey: [...LEAD_INDICATORS_QUERY_KEY, 'total-leads'],
    queryFn: () => leadsApi.getTotalLeads(),
  });
}

export function useNewLeadsInLastSevenDays() {
  return useQuery({
    queryKey: [...LEAD_INDICATORS_QUERY_KEY, 'new-leads'],
    queryFn: () => leadsApi.getNewLeadsInLastSevenDays(),
  });
}

export function useUnassignedLeads() {
  return useQuery({
    queryKey: [...LEAD_INDICATORS_QUERY_KEY, 'unassigned-leads'],
    queryFn: () => leadsApi.getUnassignedLeads(),
  });
}

export function useInvalidOrRejectedContacts() {
  return useQuery({
    queryKey: [...LEAD_INDICATORS_QUERY_KEY, 'invalid-or-rejected-contacts'],
    queryFn: () => leadsApi.getInvalidOrRejectedContacts(),
  });
}

export function useCompleteProfiles() {
  return useQuery({
    queryKey: [...LEAD_INDICATORS_QUERY_KEY, 'complete-profiles'],
    queryFn: () => leadsApi.getCompleteProfiles(),
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

export function useRequestLeadImport() {
  return useMutation({
    mutationFn: (csvText: string) => leadsApi.requestLeadImport(csvText),
  });
}

function isLeadImportRunning(leadImportProgress: LeadImportProgress | undefined) {
  return leadImportProgress === undefined || RUNNING_LEAD_IMPORT_STATUSES.includes(leadImportProgress.status);
}

export function useLeadImportProgress(importId: string | null) {
  const queryClient = useQueryClient();
  const leadImportProgressQuery = useQuery({
    queryKey: [...LEADS_QUERY_KEY, 'imports', importId],
    queryFn: () => leadsApi.getLeadImportProgress(importId as string),
    enabled: importId !== null,
    refetchInterval: (query) => (isLeadImportRunning(query.state.data) ? LEAD_IMPORT_PROGRESS_CHECK_EVERY_MS : false),
  });

  const hasFinishedImporting = leadImportProgressQuery.data?.status === 'COMPLETED';
  useEffect(() => {
    if (hasFinishedImporting) void queryClient.invalidateQueries({ queryKey: LEADS_QUERY_KEY, refetchType: 'active' });
  }, [hasFinishedImporting, queryClient]);

  return leadImportProgressQuery;
}
