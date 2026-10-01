import Papa from 'papaparse';
import { separateDuplicateLeadRows, type DuplicateLeadRow } from './duplicateLeadRows';
import { isValidEmail, normalizeEmail } from './email';
import { findProblemWithLeadName, normalizeLeadName } from './leadName';
import { readLeadPhone } from './phone';
import { readSpreadsheetDate } from './spreadsheetDate';
import {
  identifySpreadsheetColumns,
  LEAD_SPREADSHEET_FIELD_LABELS,
  type LeadSpreadsheetField,
  type SpreadsheetColumnIdentification,
} from './spreadsheetColumns';

const BYTE_ORDER_MARK = /^﻿/;
const HEADER_ROW_NUMBER = 1;
const MAXIMUM_COLUMNS = 50;

export interface LeadSpreadsheetRowToImport {
  rowNumber: number;
  name: string;
  phone: string;
  phoneCountry: string | null;
  email: string | null;
  enteredOn: string | null;
}

export interface InvalidLeadSpreadsheetRow {
  rowNumber: number;
  problems: string[];
}

export interface LeadSpreadsheetContent {
  totalRows: number;
  rowsToImport: LeadSpreadsheetRowToImport[];
  invalidRows: InvalidLeadSpreadsheetRow[];
  duplicateRows: DuplicateLeadRow[];
  ignoredHeaders: string[];
}

export type LeadSpreadsheetReading =
  | { status: 'unreadable'; reason: string }
  | { status: 'read'; content: LeadSpreadsheetContent };

export interface LeadSpreadsheetLimits {
  maximumRows: number;
}

type SpreadsheetRow = string[];
type RowReading = { status: 'valid'; row: LeadSpreadsheetRowToImport } | { status: 'invalid'; row: InvalidLeadSpreadsheetRow };

type CsvParsing = { status: 'parsed'; rows: SpreadsheetRow[] } | { status: 'stopped'; reason: string };

function parseCsvRows(csvText: string, limits: LeadSpreadsheetLimits): CsvParsing {
  const rows: SpreadsheetRow[] = [];
  let stopReason: string | null = null;
  const stopParsing = (reason: string, parser: Papa.Parser) => {
    stopReason = reason;
    parser.abort();
  };

  Papa.parse<SpreadsheetRow>(csvText.replace(BYTE_ORDER_MARK, ''), {
    skipEmptyLines: 'greedy',
    step: (parsedRow, parser) => {
      if (stopReason !== null) return;
      const rowNumber = rows.length + HEADER_ROW_NUMBER;
      if (parsedRow.errors.some((parsingError) => parsingError.type === 'Quotes')) {
        return stopParsing(`Aspas sem fechamento perto da linha ${rowNumber}`, parser);
      }
      if (parsedRow.data.length > MAXIMUM_COLUMNS) {
        return stopParsing(`A planilha tem mais de ${MAXIMUM_COLUMNS} colunas na linha ${rowNumber}`, parser);
      }
      rows.push(parsedRow.data);
      if (rows.length > limits.maximumRows + HEADER_ROW_NUMBER) {
        return stopParsing(`A planilha passa do limite de ${limits.maximumRows} leads por importação`, parser);
      }
    },
  });

  return stopReason === null ? { status: 'parsed', rows } : { status: 'stopped', reason: stopReason };
}

function describeMissingColumns(missingFields: LeadSpreadsheetField[]): string {
  const missingLabels = missingFields.map((field) => LEAD_SPREADSHEET_FIELD_LABELS[field]).join(' e ');
  return `A planilha precisa ter a coluna de ${missingLabels}`;
}

function describeRepeatedColumns(columns: SpreadsheetColumnIdentification): string | null {
  const repeatedField = columns.fieldsWithMoreThanOneColumn[0];
  if (!repeatedField) return null;
  const label = LEAD_SPREADSHEET_FIELD_LABELS[repeatedField.field];
  return `A planilha tem mais de uma coluna de ${label}: ${repeatedField.headers.join(', ')}`;
}

function readCell(row: SpreadsheetRow, columnIndex: number | null): string {
  if (columnIndex === null) return '';
  return row[columnIndex] ?? '';
}

function readSpreadsheetRow(
  row: SpreadsheetRow,
  rowNumber: number,
  columns: SpreadsheetColumnIdentification,
  today: Date,
): RowReading {
  const problems: string[] = [];
  const { columnIndexByField } = columns;

  const name = normalizeLeadName(readCell(row, columnIndexByField.name));
  const nameProblem = findProblemWithLeadName(name);
  if (nameProblem) problems.push(nameProblem);

  const phoneReading = readLeadPhone(readCell(row, columnIndexByField.phone));
  if (phoneReading.status === 'empty') problems.push('Telefone vazio');
  if (phoneReading.status === 'invalid') problems.push(phoneReading.reason);

  const normalizedEmail = normalizeEmail(readCell(row, columnIndexByField.email));
  const email = normalizedEmail === '' ? null : normalizedEmail;
  if (email !== null && !isValidEmail(email)) problems.push(`E-mail inválido: "${email}"`);

  const dateReading = readSpreadsheetDate(readCell(row, columnIndexByField.enteredOn), today);
  if (dateReading.status === 'invalid') problems.push(dateReading.reason);

  if (problems.length > 0 || phoneReading.status !== 'valid') return { status: 'invalid', row: { rowNumber, problems } };

  return {
    status: 'valid',
    row: {
      rowNumber,
      name,
      phone: phoneReading.internationalPhone,
      phoneCountry: phoneReading.country ?? null,
      email,
      enteredOn: dateReading.status === 'valid' ? dateReading.isoDate : null,
    },
  };
}

export function readLeadSpreadsheet(csvText: string, today: Date, limits: LeadSpreadsheetLimits): LeadSpreadsheetReading {
  const csvParsing = parseCsvRows(csvText, limits);
  if (csvParsing.status === 'stopped') return { status: 'unreadable', reason: csvParsing.reason };

  const [headerRow, ...dataRows] = csvParsing.rows;
  if (!headerRow) return { status: 'unreadable', reason: 'A planilha está vazia' };
  if (dataRows.length === 0) return { status: 'unreadable', reason: 'A planilha só tem o cabeçalho, sem leads' };

  const columns = identifySpreadsheetColumns(headerRow);
  if (columns.missingRequiredFields.length > 0) {
    return { status: 'unreadable', reason: describeMissingColumns(columns.missingRequiredFields) };
  }
  const repeatedColumnsProblem = describeRepeatedColumns(columns);
  if (repeatedColumnsProblem) return { status: 'unreadable', reason: repeatedColumnsProblem };

  const validRows: LeadSpreadsheetRowToImport[] = [];
  const invalidRows: InvalidLeadSpreadsheetRow[] = [];
  dataRows.forEach((row, dataRowIndex) => {
    const rowReading = readSpreadsheetRow(row, dataRowIndex + HEADER_ROW_NUMBER + 1, columns, today);
    if (rowReading.status === 'valid') validRows.push(rowReading.row);
    else invalidRows.push(rowReading.row);
  });

  const { uniqueRows, duplicateRows } = separateDuplicateLeadRows(validRows);
  return {
    status: 'read',
    content: {
      totalRows: dataRows.length,
      rowsToImport: uniqueRows,
      invalidRows,
      duplicateRows,
      ignoredHeaders: columns.ignoredHeaders,
    },
  };
}
