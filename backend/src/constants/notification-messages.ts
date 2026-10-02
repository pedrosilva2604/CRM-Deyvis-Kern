import type { LeadImportDestination } from '@/models/lead-import.model';

const integerFormatter = new Intl.NumberFormat('pt-BR');

function formatLeadCount(quantity: number): string {
  return `${integerFormatter.format(quantity)} ${quantity === 1 ? 'lead' : 'leads'}`;
}

export interface CompletedLeadImportSummary {
  importedLeads: number;
  skippedExistingLeads: number;
  restoredLeads: number;
  skippedDeletedLeads: number;
  addedToPipelineLeads: number;
  alreadyInPipelineLeads: number;
  destination: LeadImportDestination | null;
}

function describeCompletedLeadImport({
  importedLeads,
  skippedExistingLeads,
  restoredLeads,
  skippedDeletedLeads,
  addedToPipelineLeads,
  alreadyInPipelineLeads,
  destination,
}: CompletedLeadImportSummary): string {
  const sentences = [`${formatLeadCount(importedLeads)} importados para o CRM.`];
  if (restoredLeads > 0) sentences.push(`${formatLeadCount(restoredLeads)} que estavam excluídos foram restaurados.`);
  if (skippedExistingLeads > 0) sentences.push(`${formatLeadCount(skippedExistingLeads)} já existiam no CRM e não foram duplicados.`);
  if (skippedDeletedLeads > 0) {
    sentences.push(`${formatLeadCount(skippedDeletedLeads)} pertencem a leads excluídos: peça a um administrador para restaurá-los.`);
  }
  if (destination !== null) sentences.push(`${formatLeadCount(addedToPipelineLeads)} entraram no funil.`);
  if (alreadyInPipelineLeads > 0) {
    sentences.push(`${formatLeadCount(alreadyInPipelineLeads)} já estavam no funil e continuaram onde estavam.`);
  }
  return sentences.join(' ');
}

export const PIPELINE_NOTIFICATION_MESSAGES = {
  MEMBER_ADDED: {
    title: 'Você foi adicionado a um funil',
    message: (pipelineName: string) => `Agora você participa do funil "${pipelineName}" e pode trabalhar nele.`,
  },
} as const;

export const LEAD_IMPORT_NOTIFICATION_MESSAGES = {
  COMPLETED: {
    title: 'Importação concluída',
    message: describeCompletedLeadImport,
  },
  FAILED: {
    title: 'Importação interrompida',
    message: (importedLeads: number, retryAvailableUntil: string) =>
      `A importação parou por uma instabilidade no servidor. ${formatLeadCount(importedLeads)} já importados foram mantidos. Você pode tentar de novo até ${retryAvailableUntil}.`,
  },
  EXPIRING: {
    title: 'Importação expira amanhã',
    message: (retryAvailableUntil: string) =>
      `A importação que foi interrompida pode ser retomada só até ${retryAvailableUntil}. Depois disso, será preciso enviar a planilha de novo.`,
  },
  EXPIRED: {
    title: 'Importação expirada',
    message: () => 'A importação que foi interrompida expirou. Para importar esses leads, envie a planilha de novo.',
  },
} as const;
