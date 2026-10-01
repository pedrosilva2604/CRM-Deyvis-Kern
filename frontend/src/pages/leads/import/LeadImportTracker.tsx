import { Loader2 } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { useLeadImportProgress } from '@/hooks/useLeads';
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

function describeCompletedImport({ importedLeads, skippedExistingLeads }: LeadImportProgress) {
  const importedDescription = `${formatInteger(importedLeads)} leads importados.`;
  if (skippedExistingLeads === 0) return importedDescription;
  return `${importedDescription} ${formatInteger(skippedExistingLeads)} já existiam no CRM e foram ignorados.`;
}

export function LeadImportTracker({ importId }: LeadImportTrackerProps) {
  const { data: leadImportProgress, isError } = useLeadImportProgress(importId);

  if (isError) return <Alert variant="error">Não foi possível consultar o andamento da importação.</Alert>;
  if (!leadImportProgress || leadImportProgress.status === 'PENDING') {
    return <RunningImport description="Na fila: a importação vai começar em instantes." />;
  }
  if (leadImportProgress.status === 'PROCESSING') return <RunningImport description="Importando os leads..." />;
  if (leadImportProgress.status === 'FAILED') {
    return <Alert variant="error">A importação não pôde ser concluída. Tente enviar a planilha de novo.</Alert>;
  }
  if (leadImportProgress.status === 'EXPIRED') {
    return <Alert variant="error">Esta importação expirou. Para importar esses leads, envie a planilha de novo.</Alert>;
  }
  return <Alert variant="success">{describeCompletedImport(leadImportProgress)}</Alert>;
}
