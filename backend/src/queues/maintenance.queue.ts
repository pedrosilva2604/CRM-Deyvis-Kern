import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';

export const MAINTENANCE_QUEUE_NAME = 'maintenance';
export const RECONCILE_LEAD_IMPORTS_JOB_NAME = 'reconcile-stuck-lead-imports';
export const EXPIRE_FAILED_LEAD_IMPORTS_JOB_NAME = 'expire-failed-lead-imports';
export const DELETE_OLD_READ_NOTIFICATIONS_JOB_NAME = 'delete-old-read-notifications';

const KEEP_LAST_FAILED_MAINTENANCE_JOBS = 50;

export interface MaintenanceSchedule {
  reconcileLeadImportsEveryMs: number;
  dailyMaintenanceCron: string;
  businessTimeZone: string;
}

export class MaintenanceScheduler {
  private readonly queue: Queue;

  constructor(
    redisClient: Redis,
    private readonly schedule: MaintenanceSchedule,
  ) {
    this.queue = new Queue(MAINTENANCE_QUEUE_NAME, { connection: redisClient });
    this.queue.on('error', (error) => console.error(`Fila de manutenção indisponível: ${error.message}`));
  }

  async registerSchedules(): Promise<void> {
    await this.scheduleEvery(RECONCILE_LEAD_IMPORTS_JOB_NAME, this.schedule.reconcileLeadImportsEveryMs);
    await this.scheduleDaily(EXPIRE_FAILED_LEAD_IMPORTS_JOB_NAME);
    await this.scheduleDaily(DELETE_OLD_READ_NOTIFICATIONS_JOB_NAME);
  }

  async close(): Promise<void> {
    await this.queue.close();
  }

  private async scheduleEvery(jobName: string, everyMs: number): Promise<void> {
    await this.queue.upsertJobScheduler(jobName, { every: everyMs }, { name: jobName, opts: this.maintenanceJobOptions() });
  }

  private async scheduleDaily(jobName: string): Promise<void> {
    await this.queue.upsertJobScheduler(
      jobName,
      { pattern: this.schedule.dailyMaintenanceCron, tz: this.schedule.businessTimeZone },
      { name: jobName, opts: this.maintenanceJobOptions() },
    );
  }

  private maintenanceJobOptions() {
    return { removeOnComplete: true, removeOnFail: KEEP_LAST_FAILED_MAINTENANCE_JOBS };
  }
}
