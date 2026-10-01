import type { Clock } from '@/infra/clock';

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export class FixedClock implements Clock {
  constructor(private readonly fixedNow: Date) {}

  now(): Date {
    return new Date(this.fixedNow);
  }

  minutesAgo(minutes: number): Date {
    return new Date(this.fixedNow.getTime() - minutes * MINUTE_MS);
  }

  daysAgo(days: number): Date {
    return new Date(this.fixedNow.getTime() - days * DAY_MS);
  }
}
