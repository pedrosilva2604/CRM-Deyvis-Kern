import { useEffect, useState, type SelectHTMLAttributes } from 'react';
import { Search, X } from 'lucide-react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { LeadContactStatus, LeadFilterOptions, LeadListFilters } from '@/types/lead';
import { CONTACT_STATUS_LABELS, UNASSIGNED_LEADS_FILTER } from '@/types/lead';

const SEARCH_TYPING_PAUSE_MS = 350;

interface FilterSelectOption {
  value: string;
  label: string;
}

interface CompactSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label: string;
  allOptionsLabel: string;
  options: FilterSelectOption[];
  onValueChange: (selectedValue: string) => void;
}

function CompactSelect({ label, allOptionsLabel, options, onValueChange, ...props }: CompactSelectProps) {
  return (
    <select
      aria-label={label}
      onChange={(event) => onValueChange(event.target.value)}
      className="rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-8 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-indigo-900/40"
      {...props}
    >
      <option value="">{allOptionsLabel}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

interface LeadListFiltersBarProps {
  filters: LeadListFilters;
  filterOptions: LeadFilterOptions | undefined;
  hasActiveFilters: boolean;
  onFiltersChange: (filterChanges: Partial<LeadListFilters>) => void;
  onClearFilters: () => void;
}

export function LeadListFiltersBar({
  filters,
  filterOptions,
  hasActiveFilters,
  onFiltersChange,
  onClearFilters,
}: LeadListFiltersBarProps) {
  const [typedSearch, setTypedSearch] = useState(filters.search);
  const settledSearch = useDebouncedValue(typedSearch, SEARCH_TYPING_PAUSE_MS);

  useEffect(() => {
    if (settledSearch !== filters.search) onFiltersChange({ search: settledSearch });
  }, [settledSearch]);

  useEffect(() => {
    if (filters.search !== settledSearch) setTypedSearch(filters.search);
  }, [filters.search]);

  const stageOptions = (filterOptions?.pipelines ?? []).flatMap((pipeline) =>
    pipeline.stages.map((stage) => ({ value: stage.id, label: stage.name })),
  );
  const sourceOptions = (filterOptions?.sources ?? []).map((source) => ({ value: source, label: source }));
  const assignmentOptions = [
    { value: UNASSIGNED_LEADS_FILTER, label: 'Sem responsável' },
    ...(filterOptions?.assignees ?? []).map((assignee) => ({ value: assignee.id, label: assignee.name })),
  ];
  const contactStatusOptions = (Object.keys(CONTACT_STATUS_LABELS) as LeadContactStatus[]).map((status) => ({
    value: status,
    label: CONTACT_STATUS_LABELS[status],
  }));

  function clearSearchAndFilters() {
    setTypedSearch('');
    onClearFilters();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          aria-label="Buscar leads"
          placeholder="Buscar por nome, e-mail ou telefone"
          value={typedSearch}
          onChange={(event) => setTypedSearch(event.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:placeholder:text-slate-500 dark:focus:ring-indigo-900/40"
        />
      </div>
      <CompactSelect
        label="Filtrar por etapa"
        allOptionsLabel="Todas as etapas"
        options={stageOptions}
        value={filters.stageId}
        onValueChange={(stageId) => onFiltersChange({ stageId })}
      />
      <CompactSelect
        label="Filtrar por origem"
        allOptionsLabel="Todas as origens"
        options={sourceOptions}
        value={filters.source}
        onValueChange={(source) => onFiltersChange({ source })}
      />
      <CompactSelect
        label="Filtrar por responsável"
        allOptionsLabel="Todos os responsáveis"
        options={assignmentOptions}
        value={filters.assignment}
        onValueChange={(assignment) => onFiltersChange({ assignment })}
      />
      <CompactSelect
        label="Filtrar por qualidade do contato"
        allOptionsLabel="Qualquer qualidade"
        options={contactStatusOptions}
        value={filters.contactStatus}
        onValueChange={(contactStatus) => onFiltersChange({ contactStatus: contactStatus as LeadContactStatus | '' })}
      />
      {(hasActiveFilters || typedSearch !== '') && (
        <button
          type="button"
          onClick={clearSearchAndFilters}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <X size={14} />
          Limpar filtros
        </button>
      )}
    </div>
  );
}
