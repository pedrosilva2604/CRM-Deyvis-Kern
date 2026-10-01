import { readLeadSpreadsheet, type LeadSpreadsheetContent } from '@crm/shared';
import { env } from '@/config/env';
import { formatFileSize } from '@/lib/formatters';
import {
  decodeSpreadsheetText,
  hasAcceptedFileExtension,
  looksLikeBinaryFile,
  measureUtf8Bytes,
} from '@/lib/uploadedFileValidation';

export type UploadedSpreadsheetReading =
  | { status: 'rejected'; reason: string }
  | { status: 'read'; csvText: string; content: LeadSpreadsheetContent };

function rejectSpreadsheet(reason: string): UploadedSpreadsheetReading {
  return { status: 'rejected', reason };
}

function describeFileTooLarge(fileBytes: number) {
  return `O arquivo tem ${formatFileSize(fileBytes)}; o limite é ${formatFileSize(env.leadImportMaximumFileBytes)}`;
}

export async function readUploadedSpreadsheet(file: File): Promise<UploadedSpreadsheetReading> {
  if (!hasAcceptedFileExtension(file.name)) {
    return rejectSpreadsheet('O arquivo precisa ser .csv. No Excel, use "Salvar como" e escolha CSV.');
  }
  if (file.size === 0) return rejectSpreadsheet('O arquivo está vazio');
  if (file.size > env.leadImportMaximumFileBytes) return rejectSpreadsheet(describeFileTooLarge(file.size));

  const fileBytes = new Uint8Array(await file.arrayBuffer());
  if (looksLikeBinaryFile(fileBytes)) {
    return rejectSpreadsheet('O conteúdo não é um CSV, mesmo com a extensão .csv. Salve a planilha como CSV e tente de novo.');
  }

  const csvText = decodeSpreadsheetText(fileBytes);
  const csvTextBytes = measureUtf8Bytes(csvText);
  if (csvTextBytes > env.leadImportMaximumFileBytes) return rejectSpreadsheet(describeFileTooLarge(csvTextBytes));

  const spreadsheetReading = readLeadSpreadsheet(csvText, new Date(), { maximumRows: env.leadImportMaximumRows });
  if (spreadsheetReading.status === 'unreadable') return rejectSpreadsheet(spreadsheetReading.reason);
  return { status: 'read', csvText, content: spreadsheetReading.content };
}
