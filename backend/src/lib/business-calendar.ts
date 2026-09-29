import type { Clock } from './clock';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export interface BusinessCalendar {
  todayAsIsoDate(): string;
  todayAsCalendarDate(): Date;
  isoDateDaysBeforeToday(numberOfDays: number): string;
  toDatabaseDate(isoDate: string): Date;
  fromDatabaseDate(databaseDate: Date): string;
}

export class TimeZoneBusinessCalendar implements BusinessCalendar {
  private readonly isoDateFormatter: Intl.DateTimeFormat;

  constructor(
    private readonly clock: Clock,
    timeZone: string,
  ) {
    this.isoDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  todayAsIsoDate(): string {
    return this.isoDateFormatter.format(this.clock.now());
  }

  todayAsCalendarDate(): Date {
    const [year, month, day] = this.todayAsIsoDate().split('-').map(Number);
    return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  }

  isoDateDaysBeforeToday(numberOfDays: number): string {
    const today = this.toDatabaseDate(this.todayAsIsoDate());
    return this.fromDatabaseDate(new Date(today.getTime() - numberOfDays * MILLISECONDS_PER_DAY));
  }

  toDatabaseDate(isoDate: string): Date {
    return new Date(`${isoDate}T00:00:00.000Z`);
  }

  fromDatabaseDate(databaseDate: Date): string {
    return databaseDate.toISOString().slice(0, 10);
  }
}
