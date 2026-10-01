import { describe, expect, it } from 'vitest';
import { readSpreadsheetDate } from './spreadsheetDate';

const TODAY = new Date(2026, 8, 30);

describe('readSpreadsheetDate', () => {
  it.each([
    ['15/03/2026', '2026-03-15'],
    ['5/3/2026', '2026-03-05'],
    ['2026-03-15', '2026-03-15'],
    ['30/09/2026', '2026-09-30'],
  ])('aceita "%s" como %s', (rawDate, isoDate) => {
    expect(readSpreadsheetDate(rawDate, TODAY)).toEqual({ status: 'valid', isoDate });
  });

  it('trata data em branco como vazia', () => {
    expect(readSpreadsheetDate('  ', TODAY)).toEqual({ status: 'empty' });
  });

  it.each([
    ['01/10/2026', 'Data no futuro'],
    ['31/02/2026', 'Data que não existe'],
    ['29/02/2025', 'Data que não existe'],
    ['01/01/1899', 'Data anterior a 1900'],
    ['2026/03/15', 'formato não reconhecido'],
    ['15-03-2026 10:30', 'formato não reconhecido'],
  ])('recusa "%s" (%s)', (rawDate, expectedReason) => {
    expect(readSpreadsheetDate(rawDate, TODAY)).toMatchObject({ status: 'invalid', reason: expect.stringContaining(expectedReason) });
  });

  it('aceita 29 de fevereiro em ano bissexto', () => {
    expect(readSpreadsheetDate('29/02/2024', TODAY)).toEqual({ status: 'valid', isoDate: '2024-02-29' });
  });
});
