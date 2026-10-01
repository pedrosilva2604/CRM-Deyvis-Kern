import { useState } from 'react';
import { Upload, UsersRound } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { env } from '@/config/env';
import { LEADS_PAGE_SIZE } from '@/api/leadsApi';
import { useLeadFilterOptions, useLeadList } from '@/hooks/useLeads';
import { ImportLeadsDialog } from './import/ImportLeadsDialog';
import { LeadBaseIndicatorsPanel } from './LeadBaseIndicatorsPanel';
import { LeadDetailsDrawer } from './LeadDetailsDrawer';
import { LeadListFiltersBar } from './LeadListFiltersBar';
import { LeadsTable } from './LeadsTable';
import { useLeadsPageUrlState } from './useLeadsPageUrlState';

export function LeadsPage() {
  const { filters, hasActiveFilters, updateFilters, clearFilters, selectedLeadId, openLeadDetails, closeLeadDetails } =
    useLeadsPageUrlState();
  const { data: leadListPage, isPending, isError, isPlaceholderData, refetch } = useLeadList(filters);
  const { data: filterOptions } = useLeadFilterOptions();
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  const leads = leadListPage?.leads ?? [];
  const hasNoLeadsAtAll = !isPending && !isError && leads.length === 0 && !hasActiveFilters;
  const hasNoMatchingLeads = !isPending && !isError && leads.length === 0 && hasActiveFilters;

  return (
    <>
      <PageHeader
        title="Leads"
        description="Toda a base de contatos do CRM"
        actions={
          <Button onClick={() => setIsImportDialogOpen(true)}>
            <Upload size={16} />
            Importar leads
          </Button>
        }
      />

      <div className="space-y-5 p-6">
        {env.fakeApiEnabled && (
          <Alert variant="warning">
            Dados de demonstração: esta página usa uma API simulada no navegador (VITE_ENABLE_API_MOCKS). Nada é salvo no
            banco.
          </Alert>
        )}

        <LeadBaseIndicatorsPanel />

        <LeadListFiltersBar
          filters={filters}
          filterOptions={filterOptions}
          hasActiveFilters={hasActiveFilters}
          onFiltersChange={updateFilters}
          onClearFilters={clearFilters}
        />

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {isPending && (
            <p className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">Carregando leads...</p>
          )}

          {isError && (
            <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-300">Não foi possível carregar os leads.</p>
              <Button variant="secondary" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            </div>
          )}

          {hasNoLeadsAtAll && (
            <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
              <UsersRound size={32} className="text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-600 dark:text-slate-300">Nenhum lead cadastrado ainda.</p>
              <Button onClick={() => setIsImportDialogOpen(true)}>
                <Upload size={16} />
                Importar a primeira planilha
              </Button>
            </div>
          )}

          {hasNoMatchingLeads && (
            <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-300">Nenhum lead encontrado com esses filtros.</p>
              <Button variant="secondary" onClick={clearFilters}>
                Limpar filtros
              </Button>
            </div>
          )}

          {leadListPage && leads.length > 0 && (
            <>
              <LeadsTable leads={leads} isRefreshing={isPlaceholderData} onOpenLeadDetails={openLeadDetails} />
              <Pagination
                page={leadListPage.page}
                pageSize={LEADS_PAGE_SIZE}
                totalItems={leadListPage.totalMatchingLeads}
                itemLabelPlural="leads"
                onPageChange={(page) => updateFilters({ page })}
              />
            </>
          )}
        </div>
      </div>

      {selectedLeadId && <LeadDetailsDrawer leadId={selectedLeadId} onClose={closeLeadDetails} />}
      {isImportDialogOpen && <ImportLeadsDialog onClose={() => setIsImportDialogOpen(false)} />}
    </>
  );
}
