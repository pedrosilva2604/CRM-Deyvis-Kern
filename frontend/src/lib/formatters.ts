const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;
const SECONDS_PER_MONTH = 30 * SECONDS_PER_DAY;
const SECONDS_PER_YEAR = 365 * SECONDS_PER_DAY;

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const integerFormatter = new Intl.NumberFormat('pt-BR');
const percentageFormatter = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const relativeTimeFormatter = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

export function formatCurrencyInReais(decimalValue: string) {
  return currencyFormatter.format(Number(decimalValue));
}

export function formatInteger(quantity: number) {
  return integerFormatter.format(quantity);
}

export function formatShareOfTotal(part: number, total: number) {
  return percentageFormatter.format(total === 0 ? 0 : part / total);
}

export function formatDate(isoDate: string) {
  return dateFormatter.format(new Date(isoDate));
}

export function formatCalendarDate(isoCalendarDate: string) {
  const [year, month, day] = isoCalendarDate.split('-').map(Number);
  return dateFormatter.format(new Date(year ?? 0, (month ?? 1) - 1, day ?? 1));
}

export function formatDateTime(isoDate: string) {
  return dateTimeFormatter.format(new Date(isoDate));
}

export function formatTimeAgo(isoDate: string, now: Date = new Date()) {
  const elapsedSeconds = Math.round((new Date(isoDate).getTime() - now.getTime()) / 1000);
  const absoluteSeconds = Math.abs(elapsedSeconds);

  if (absoluteSeconds < SECONDS_PER_MINUTE) return relativeTimeFormatter.format(0, 'second');
  if (absoluteSeconds < SECONDS_PER_HOUR) return relativeTimeFormatter.format(Math.round(elapsedSeconds / SECONDS_PER_MINUTE), 'minute');
  if (absoluteSeconds < SECONDS_PER_DAY) return relativeTimeFormatter.format(Math.round(elapsedSeconds / SECONDS_PER_HOUR), 'hour');
  if (absoluteSeconds < SECONDS_PER_MONTH) return relativeTimeFormatter.format(Math.round(elapsedSeconds / SECONDS_PER_DAY), 'day');
  if (absoluteSeconds < SECONDS_PER_YEAR) return relativeTimeFormatter.format(Math.round(elapsedSeconds / SECONDS_PER_MONTH), 'month');
  return relativeTimeFormatter.format(Math.round(elapsedSeconds / SECONDS_PER_YEAR), 'year');
}
