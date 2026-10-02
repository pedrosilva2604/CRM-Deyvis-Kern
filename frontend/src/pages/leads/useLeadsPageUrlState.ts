import { useSearchParams } from 'react-router';
import type { LeadContactStatus, LeadListFilters } from '@/types/lead';
import { CONTACT_STATUS_LABELS } from '@/types/lead';

type TextFilterName = Exclude<keyof LeadListFilters, 'page'>;

const URL_PARAM_BY_FILTER: Record<keyof LeadListFilters, string> = {
  search: 'busca',
  stageId: 'etapa',
  source: 'origem',
  assignment: 'responsavel',
  contactStatus: 'qualidade',
  page: 'pagina',
};

const SELECTED_LEAD_URL_PARAM = 'lead';
const TRACKED_IMPORT_URL_PARAM = 'importacao';

function isLeadContactStatus(value: string): value is LeadContactStatus {
  return value in CONTACT_STATUS_LABELS;
}

function readPageNumber(rawPage: string | null) {
  const pageNumber = Number(rawPage);
  return Number.isInteger(pageNumber) && pageNumber >= 1 ? pageNumber : 1;
}

export function useLeadsPageUrlState() {
  const [searchParams, setSearchParams] = useSearchParams();

  const readText = (filterName: TextFilterName) => searchParams.get(URL_PARAM_BY_FILTER[filterName]) ?? '';
  const rawContactStatus = readText('contactStatus');

  const filters: LeadListFilters = {
    search: readText('search'),
    stageId: readText('stageId'),
    source: readText('source'),
    assignment: readText('assignment'),
    contactStatus: isLeadContactStatus(rawContactStatus) ? rawContactStatus : '',
    page: readPageNumber(searchParams.get(URL_PARAM_BY_FILTER.page)),
  };

  const hasActiveFilters = Boolean(
    filters.search || filters.stageId || filters.source || filters.assignment || filters.contactStatus,
  );

  function updateFilters(filterChanges: Partial<LeadListFilters>) {
    setSearchParams(
      (currentParams) => {
        const nextParams = new URLSearchParams(currentParams);
        for (const [filterName, filterValue] of Object.entries(filterChanges)) {
          const urlParam = URL_PARAM_BY_FILTER[filterName as keyof LeadListFilters];
          if (filterValue === '' || filterValue === 1) nextParams.delete(urlParam);
          else nextParams.set(urlParam, String(filterValue));
        }
        const isChangingOnlyThePage = Object.keys(filterChanges).every((filterName) => filterName === 'page');
        if (!isChangingOnlyThePage) nextParams.delete(URL_PARAM_BY_FILTER.page);
        return nextParams;
      },
      { replace: true },
    );
  }

  function clearFilters() {
    setSearchParams(
      (currentParams) => {
        const nextParams = new URLSearchParams();
        const selectedLeadId = currentParams.get(SELECTED_LEAD_URL_PARAM);
        if (selectedLeadId) nextParams.set(SELECTED_LEAD_URL_PARAM, selectedLeadId);
        return nextParams;
      },
      { replace: true },
    );
  }

  const selectedLeadId = searchParams.get(SELECTED_LEAD_URL_PARAM);

  function openLeadDetails(leadId: string) {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      nextParams.set(SELECTED_LEAD_URL_PARAM, leadId);
      return nextParams;
    });
  }

  function closeLeadDetails() {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      nextParams.delete(SELECTED_LEAD_URL_PARAM);
      return nextParams;
    });
  }

  const trackedImportId = searchParams.get(TRACKED_IMPORT_URL_PARAM);

  function stopTrackingImport() {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      nextParams.delete(TRACKED_IMPORT_URL_PARAM);
      return nextParams;
    });
  }

  return {
    filters,
    hasActiveFilters,
    updateFilters,
    clearFilters,
    selectedLeadId,
    openLeadDetails,
    closeLeadDetails,
    trackedImportId,
    stopTrackingImport,
  };
}
