export interface LeadRowIdentity {
  rowNumber: number;
  phone: string;
  email: string | null;
}

export interface DuplicateLeadRow {
  rowNumber: number;
  sameAsRowNumber: number;
  matchedBy: 'phone' | 'email';
}

export interface SeparatedLeadRows<TLeadRow extends LeadRowIdentity> {
  uniqueRows: TLeadRow[];
  duplicateRows: DuplicateLeadRow[];
}

export function separateDuplicateLeadRows<TLeadRow extends LeadRowIdentity>(
  leadRows: TLeadRow[],
): SeparatedLeadRows<TLeadRow> {
  const firstRowNumberByPhone = new Map<string, number>();
  const firstRowNumberByEmail = new Map<string, number>();
  const uniqueRows: TLeadRow[] = [];
  const duplicateRows: DuplicateLeadRow[] = [];

  for (const leadRow of leadRows) {
    const rowWithSamePhone = firstRowNumberByPhone.get(leadRow.phone);
    const rowWithSameEmail = leadRow.email === null ? undefined : firstRowNumberByEmail.get(leadRow.email);

    if (rowWithSamePhone !== undefined) {
      duplicateRows.push({ rowNumber: leadRow.rowNumber, sameAsRowNumber: rowWithSamePhone, matchedBy: 'phone' });
      continue;
    }
    if (rowWithSameEmail !== undefined) {
      duplicateRows.push({ rowNumber: leadRow.rowNumber, sameAsRowNumber: rowWithSameEmail, matchedBy: 'email' });
      continue;
    }

    firstRowNumberByPhone.set(leadRow.phone, leadRow.rowNumber);
    if (leadRow.email !== null) firstRowNumberByEmail.set(leadRow.email, leadRow.rowNumber);
    uniqueRows.push(leadRow);
  }

  return { uniqueRows, duplicateRows };
}
