const BRAZILIAN_DATE_FORMAT = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const ISO_DATE_FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;
const OLDEST_ACCEPTED_YEAR = 1900;

export type SpreadsheetDateReading =
  | { status: 'empty' }
  | { status: 'valid'; isoDate: string }
  | { status: 'invalid'; reason: string };

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

function readCalendarDate(rawDate: string): CalendarDate | null {
  const brazilianParts = BRAZILIAN_DATE_FORMAT.exec(rawDate);
  if (brazilianParts) {
    const [, day, month, year] = brazilianParts;
    return { year: Number(year), month: Number(month), day: Number(day) };
  }

  const isoParts = ISO_DATE_FORMAT.exec(rawDate);
  if (isoParts) {
    const [, year, month, day] = isoParts;
    return { year: Number(year), month: Number(month), day: Number(day) };
  }

  return null;
}

function existsInCalendar({ year, month, day }: CalendarDate): boolean {
  const candidateDate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidateDate.getUTCFullYear() === year &&
    candidateDate.getUTCMonth() === month - 1 &&
    candidateDate.getUTCDate() === day
  );
}

function toIsoDate({ year, month, day }: CalendarDate): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function todayAsIsoDate(today: Date): string {
  return toIsoDate({ year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate() });
}

export function readSpreadsheetDate(rawDate: string, today: Date): SpreadsheetDateReading {
  const trimmedDate = rawDate.trim();
  if (trimmedDate === '') return { status: 'empty' };

  const calendarDate = readCalendarDate(trimmedDate);
  if (!calendarDate) {
    return { status: 'invalid', reason: `Data em formato não reconhecido: "${trimmedDate}" (use dd/mm/aaaa ou aaaa-mm-dd)` };
  }

  if (calendarDate.year < OLDEST_ACCEPTED_YEAR) {
    return { status: 'invalid', reason: `Data anterior a ${OLDEST_ACCEPTED_YEAR}: "${trimmedDate}"` };
  }

  if (!existsInCalendar(calendarDate)) {
    return { status: 'invalid', reason: `Data que não existe: "${trimmedDate}"` };
  }

  const isoDate = toIsoDate(calendarDate);
  if (isoDate > todayAsIsoDate(today)) {
    return { status: 'invalid', reason: `Data no futuro: "${trimmedDate}"` };
  }

  return { status: 'valid', isoDate };
}
