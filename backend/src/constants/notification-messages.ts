const integerFormatter = new Intl.NumberFormat('pt-BR');

function formatLeadCount(quantity: number): string {
  return `${integerFormatter.format(quantity)} ${quantity === 1 ? 'lead' : 'leads'}`;
}

export const LEAD_IMPORT_NOTIFICATION_MESSAGES = {
  COMPLETED: {
    title: 'Importação concluída',
    message: (importedLeads: number, skippedExistingLeads: number) =>
      skippedExistingLeads === 0
        ? `${formatLeadCount(importedLeads)} importados para o CRM.`
        : `${formatLeadCount(importedLeads)} importados; ${formatLeadCount(skippedExistingLeads)} já existiam no CRM e foram ignorados.`,
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
