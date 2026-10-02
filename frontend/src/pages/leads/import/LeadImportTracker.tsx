import { Loader2 } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { useLeadImportProgress, useRetryLeadImport } from '@/hooks/useLeads';
import { apiErrorMessage } from '@/lib/api';
import { formatInteger } from '@/lib/formatters';
import type { LeadImportProgress } from '@/types/lead';

interface LeadImportTrackerProps {
  importId: string;
}

function RunningImport({ description }: { description: string }) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Loader2 size={16} className="animate-spin text-indigo-500" />
        {description}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Você pode fechar esta janela: a importação continua e a lista de leads se atualiza quando terminar.
      </p>
    </div>
  );
}

function describeCompletedImport({ importedLeads, skippedExistingLeads, restoredLeads, skippedDeletedLeads }: LeadImportProgress) {
  const sentences = [`${formatInteger(importedLeads)} leads importados.`];
  if (restoredLeads > 0) sentences.push(`${formatInteger(restoredLeads)} que estavam excluídos foram restaurados.`);
  if (skippedExistingLeads > 0) sentences.push(`${formatInteger(skippedExistingLeads)} já existiam no CRM e foram ignorados.`);
  if (skippedDeletedLeads > 0) {
    sentences.push(`${formatInteger(skippedDeletedLeads)} pertencem a leads excluídos: peça a um administrador para restaurá-los.`);
  }
  return sentences.join(' ');
}

function InterruptedImport({ importId, progress }: { importId: string; progress: LeadImportProgress }) {
  const leadImportRetry = useRetryLeadImport(importId);
  const remainingRows = progress.rowsToImport - progress.processedRows;

  return (
    <div className="space-y-3">
      <Alert variant="error">
        A importação foi interrompida por uma instabilidade. {formatInteger(progress.importedLeads)} leads já importados
        foram mantidos; faltam {formatInteger(remainingRows)} linhas.
      </Alert>
      {leadImportRetry.isError && (
        <Alert variant="error">{apiErrorMessage(leadImportRetry.error, 'Não foi possível retomar a importação.')}</Alert>
      )}
      <Button loading={leadImportRetry.isPending} onClick={() => leadImportRetry.mutate()}>
        Retomar importação
      </Button>
    </div>
  );
}

function ProgressCheckFailed({ onTryAgain, isTryingAgain }: { onTryAgain: () => void; isTryingAgain: boolean }) {
  return (
    <div className="space-y-3">
      <Alert variant="error">
        Não foi possível acompanhar a importação. Ela pode continuar rodando: clique em Tentar de novo para ver o
        andamento.
      </Alert>
      <Button variant="secondary" onClick={onTryAgain} disabled={isTryingAgain}>
        {isTryingAgain ? 'Consultando...' : 'Tentar de novo'}
      </Button>
    </div>
  );
}

export function LeadImportTracker({ importId }: LeadImportTrackerProps) {
  const { data: leadImportProgress, isError, isFetching, refetch } = useLeadImportProgress(importId);

  if (isError) return <ProgressCheckFailed onTryAgain={() => void refetch()} isTryingAgain={isFetching} />;
  if (!leadImportProgress || leadImportProgress.status === 'PENDING') {
    return <RunningImport description="Na fila: a importação vai começar em instantes." />;
  }
  if (leadImportProgress.status === 'PROCESSING') return <RunningImport description="Importando os leads..." />;
  if (leadImportProgress.status === 'FAILED') return <InterruptedImport importId={importId} progress={leadImportProgress} />;
  if (leadImportProgress.status === 'EXPIRED') {
    return <Alert variant="error">Esta importação expirou. Para importar esses leads, envie a planilha de novo.</Alert>;
  }
  return <Alert variant="success">{describeCompletedImport(leadImportProgress)}</Alert>;
}
