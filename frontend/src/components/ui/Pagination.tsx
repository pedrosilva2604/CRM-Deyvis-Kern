import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatInteger } from '@/lib/formatters';
import { IconButton } from './IconButton';

interface PaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  itemLabelPlural: string;
  onPageChange: (nextPage: number) => void;
}

export function Pagination({ page, pageSize, totalItems, itemLabelPlural, onPageChange }: PaginationProps) {
  const lastPage = Math.max(1, Math.ceil(totalItems / pageSize));
  const firstItemShown = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItemShown = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between gap-4 border-t border-slate-200 px-5 py-3 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
      <p>
        {formatInteger(firstItemShown)}–{formatInteger(lastItemShown)} de {formatInteger(totalItems)} {itemLabelPlural}
      </p>
      <div className="flex items-center gap-2">
        <span className="tabular-nums">
          Página {page} de {lastPage}
        </span>
        <IconButton
          icon={ChevronLeft}
          label="Página anterior"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        />
        <IconButton
          icon={ChevronRight}
          label="Próxima página"
          disabled={page >= lastPage}
          onClick={() => onPageChange(page + 1)}
        />
      </div>
    </div>
  );
}
