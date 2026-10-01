const TEMPLATE_FILE_NAME = 'modelo-importacao-leads.csv';
const BYTE_ORDER_MARK = '﻿';
const EXCEL_LINE_BREAK = '\r\n';

const TEMPLATE_ROWS = [
  'data;nome;telefone;email',
  '15/03/2026;Maria Silva;(11) 98765-4321;maria.silva@exemplo.com',
  ';João Souza;+351 912 345 678;',
];

export function downloadLeadSpreadsheetTemplate() {
  const csvText = BYTE_ORDER_MARK + TEMPLATE_ROWS.join(EXCEL_LINE_BREAK) + EXCEL_LINE_BREAK;
  const templateUrl = URL.createObjectURL(new Blob([csvText], { type: 'text/csv;charset=utf-8' }));
  const downloadLink = document.createElement('a');
  downloadLink.href = templateUrl;
  downloadLink.download = TEMPLATE_FILE_NAME;
  downloadLink.click();
  URL.revokeObjectURL(templateUrl);
}
