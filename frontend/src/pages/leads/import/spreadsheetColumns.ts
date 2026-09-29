export type LeadSpreadsheetField = 'enteredOn' | 'name' | 'phone' | 'email';

export const LEAD_SPREADSHEET_FIELDS: LeadSpreadsheetField[] = ['enteredOn', 'name', 'phone', 'email'];

export const REQUIRED_LEAD_SPREADSHEET_FIELDS: LeadSpreadsheetField[] = ['name', 'phone'];

export const LEAD_SPREADSHEET_FIELD_LABELS: Record<LeadSpreadsheetField, string> = {
  enteredOn: 'data',
  name: 'nome',
  phone: 'telefone',
  email: 'email',
};

const ACCEPTED_HEADER_NAMES: Record<LeadSpreadsheetField, string[]> = {
  enteredOn: ['data', 'date', 'data de entrada', 'data entrada', 'entrada', 'data cadastro', 'data de cadastro', 'entered on'],
  name: ['nome', 'name', 'nome completo', 'full name', 'nome do lead', 'lead name'],
  phone: ['telefone', 'phone', 'celular', 'whatsapp', 'fone', 'tel', 'numero', 'mobile', 'cell', 'phone number', 'telefone celular'],
  email: ['email', 'e mail', 'mail', 'email address', 'endereco de email', 'correio eletronico'],
};

export interface SpreadsheetColumnIdentification {
  columnIndexByField: Record<LeadSpreadsheetField, number | null>;
  missingRequiredFields: LeadSpreadsheetField[];
  fieldsWithMoreThanOneColumn: Array<{ field: LeadSpreadsheetField; headers: string[] }>;
  ignoredHeaders: string[];
}

export function normalizeHeaderText(rawHeader: string): string {
  return rawHeader
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const fieldByNormalizedHeaderName = new Map<string, LeadSpreadsheetField>(
  LEAD_SPREADSHEET_FIELDS.flatMap((field) =>
    ACCEPTED_HEADER_NAMES[field].map((headerName) => [normalizeHeaderText(headerName), field] as const),
  ),
);

export function identifyFieldOfHeader(rawHeader: string): LeadSpreadsheetField | null {
  return fieldByNormalizedHeaderName.get(normalizeHeaderText(rawHeader)) ?? null;
}

export function identifySpreadsheetColumns(headers: string[]): SpreadsheetColumnIdentification {
  const columnIndexesByField = new Map<LeadSpreadsheetField, number[]>();
  const ignoredHeaders: string[] = [];

  headers.forEach((rawHeader, columnIndex) => {
    const field = identifyFieldOfHeader(rawHeader);
    if (field === null) {
      if (rawHeader.trim() !== '') ignoredHeaders.push(rawHeader.trim());
      return;
    }
    columnIndexesByField.set(field, [...(columnIndexesByField.get(field) ?? []), columnIndex]);
  });

  const columnIndexByField = Object.fromEntries(
    LEAD_SPREADSHEET_FIELDS.map((field) => [field, columnIndexesByField.get(field)?.[0] ?? null]),
  ) as Record<LeadSpreadsheetField, number | null>;

  const fieldsWithMoreThanOneColumn = LEAD_SPREADSHEET_FIELDS.flatMap((field) => {
    const columnIndexes = columnIndexesByField.get(field) ?? [];
    if (columnIndexes.length < 2) return [];
    return [{ field, headers: columnIndexes.map((columnIndex) => (headers[columnIndex] ?? '').trim()) }];
  });

  return {
    columnIndexByField,
    missingRequiredFields: REQUIRED_LEAD_SPREADSHEET_FIELDS.filter((field) => columnIndexByField[field] === null),
    fieldsWithMoreThanOneColumn,
    ignoredHeaders,
  };
}
