import type { LeadSpreadsheetContent } from '@crm/shared';
import { formatInteger } from '@/lib/formatters';

const MAXIMUM_LISTED_ROWS = 50;

const MATCHED_BY_LABELS = {
  phone: 'telefone',
  email: 'e-mail',
} as const;

interface SpreadsheetReviewProps {
  fileName: string;
  content: LeadSpreadsheetContent;
}

function ReviewNumber({ label, quantity, tone }: { label: string; quantity: number; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2.5 dark:border-slate-800">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold tabular-nums ${tone}`}>{formatInteger(quantity)}</p>
    </div>
  );
}

function RemainingRowsNote({ totalRows }: { totalRows: number }) {
  if (totalRows <= MAXIMUM_LISTED_ROWS) return null;
  return (
    <li className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
      e mais {formatInteger(totalRows - MAXIMUM_LISTED_ROWS)} linhas
    </li>
  );
}

export function SpreadsheetReview({ fileName, content }: SpreadsheetReviewProps) {
  const { totalRows, rowsToImport, invalidRows, duplicateRows, ignoredHeaders } = content;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Arquivo: <span className="font-medium text-slate-900 dark:text-slate-100">{fileName}</span>
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ReviewNumber label="Linhas na planilha" quantity={totalRows} tone="text-slate-900 dark:text-slate-100" />
        <ReviewNumber label="Serão importados" quantity={rowsToImport.length} tone="text-emerald-600 dark:text-emerald-400" />
        <ReviewNumber label="Com problema" quantity={invalidRows.length} tone="text-red-600 dark:text-red-400" />
        <ReviewNumber label="Repetidos na planilha" quantity={duplicateRows.length} tone="text-amber-600 dark:text-amber-400" />
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Leads com telefone ou e-mail que já existem no CRM são ignorados durante a importação.
        {ignoredHeaders.length > 0 && ` Colunas ignoradas: ${ignoredHeaders.join(', ')}.`}
      </p>

      {invalidRows.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Linhas com problema (não serão importadas)</h3>
          <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 text-sm dark:divide-slate-800 dark:border-slate-800">
            {invalidRows.slice(0, MAXIMUM_LISTED_ROWS).map((invalidRow) => (
              <li key={invalidRow.rowNumber} className="px-3 py-2">
                <span className="font-medium">Linha {invalidRow.rowNumber}:</span> {invalidRow.problems.join('; ')}
              </li>
            ))}
            <RemainingRowsNote totalRows={invalidRows.length} />
          </ul>
        </section>
      )}

      {duplicateRows.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Linhas repetidas (fica só a primeira)</h3>
          <ul className="max-h-40 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 text-sm dark:divide-slate-800 dark:border-slate-800">
            {duplicateRows.slice(0, MAXIMUM_LISTED_ROWS).map((duplicateRow) => (
              <li key={duplicateRow.rowNumber} className="px-3 py-2">
                <span className="font-medium">Linha {duplicateRow.rowNumber}</span> repete o{' '}
                {MATCHED_BY_LABELS[duplicateRow.matchedBy]} da linha {duplicateRow.sameAsRowNumber}
              </li>
            ))}
            <RemainingRowsNote totalRows={duplicateRows.length} />
          </ul>
        </section>
      )}
    </div>
  );
}
