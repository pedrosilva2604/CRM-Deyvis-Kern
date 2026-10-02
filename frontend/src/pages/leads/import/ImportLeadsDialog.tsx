import { useState, type ChangeEvent } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import type { LeadSpreadsheetContent } from '@crm/shared';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useRequestLeadImport } from '@/hooks/useLeads';
import { apiErrorMessage } from '@/lib/api';
import { formatInteger } from '@/lib/formatters';
import { LeadImportTracker } from './LeadImportTracker';
import { readUploadedSpreadsheet } from './readUploadedSpreadsheet';
import { downloadLeadSpreadsheetTemplate } from './spreadsheetTemplate';
import { SpreadsheetReview } from './SpreadsheetReview';

type ImportStep =
  | { name: 'choosing'; rejectionReason: string | null }
  | { name: 'reading' }
  | { name: 'reviewing'; fileName: string; csvText: string; content: LeadSpreadsheetContent }
  | { name: 'tracking'; importId: string };

interface ImportLeadsDialogProps {
  importIdToTrack?: string;
  onClose: () => void;
}

export function ImportLeadsDialog({ importIdToTrack, onClose }: ImportLeadsDialogProps) {
  const [importStep, setImportStep] = useState<ImportStep>(
    importIdToTrack ? { name: 'tracking', importId: importIdToTrack } : { name: 'choosing', rejectionReason: null },
  );
  const leadImportRequest = useRequestLeadImport();

  async function reviewChosenFile(event: ChangeEvent<HTMLInputElement>) {
    const chosenFile = event.target.files?.[0];
    event.target.value = '';
    if (!chosenFile) return;
    setImportStep({ name: 'reading' });
    const uploadedSpreadsheet = await readUploadedSpreadsheet(chosenFile);
    if (uploadedSpreadsheet.status === 'rejected') {
      setImportStep({ name: 'choosing', rejectionReason: uploadedSpreadsheet.reason });
      return;
    }
    leadImportRequest.reset();
    setImportStep({ name: 'reviewing', fileName: chosenFile.name, ...uploadedSpreadsheet });
  }

  function sendSpreadsheet(csvText: string) {
    leadImportRequest.mutate(csvText, {
      onSuccess: ({ importId }) => setImportStep({ name: 'tracking', importId }),
    });
  }

  function chooseAnotherFile() {
    leadImportRequest.reset();
    setImportStep({ name: 'choosing', rejectionReason: null });
  }

  return (
    <Modal
      title="Importar leads"
      description="Envie uma planilha CSV com as colunas data, nome, telefone e email. Nome e telefone são obrigatórios."
      size="large"
      onClose={onClose}
    >
      {(importStep.name === 'choosing' || importStep.name === 'reading') && (
        <div className="space-y-4">
          {importStep.name === 'choosing' && importStep.rejectionReason && (
            <Alert variant="error">{importStep.rejectionReason}</Alert>
          )}
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-6 py-10 text-center transition hover:border-indigo-400 hover:bg-indigo-50/40 dark:border-slate-700 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/20">
            <FileSpreadsheet size={28} className="text-slate-400" />
            <span className="text-sm font-semibold">
              {importStep.name === 'reading' ? 'Lendo a planilha...' : 'Escolher arquivo CSV'}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              A planilha é conferida aqui antes do envio: você vê o que entra e o que tem problema.
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              disabled={importStep.name === 'reading'}
              onChange={reviewChosenFile}
            />
          </label>
          <div className="flex justify-between gap-3">
            <Button variant="secondary" onClick={downloadLeadSpreadsheetTemplate}>
              <Download size={16} />
              Baixar modelo
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {importStep.name === 'reviewing' && (
        <div className="space-y-5">
          <SpreadsheetReview fileName={importStep.fileName} content={importStep.content} />
          {leadImportRequest.isError && (
            <Alert variant="error">{apiErrorMessage(leadImportRequest.error, 'Não foi possível enviar a planilha.')}</Alert>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={chooseAnotherFile} disabled={leadImportRequest.isPending}>
              Escolher outro arquivo
            </Button>
            <Button
              loading={leadImportRequest.isPending}
              disabled={importStep.content.rowsToImport.length === 0}
              onClick={() => sendSpreadsheet(importStep.csvText)}
            >
              Importar {formatInteger(importStep.content.rowsToImport.length)} leads
            </Button>
          </div>
        </div>
      )}

      {importStep.name === 'tracking' && (
        <div className="space-y-5">
          <LeadImportTracker importId={importStep.importId} />
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
