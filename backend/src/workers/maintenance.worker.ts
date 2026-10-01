import { Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import {
  DELETE_OLD_READ_NOTIFICATIONS_JOB_NAME,
  EXPIRE_FAILED_LEAD_IMPORTS_JOB_NAME,
  MAINTENANCE_QUEUE_NAME,
  RECONCILE_LEAD_IMPORTS_JOB_NAME,
} from '@/queues/maintenance.queue';
import type { ILeadImportMaintenanceService } from '@/services/lead-import-maintenance.service';
import type { INotificationService } from '@/services/notification.service';

type MaintenanceResult = Record<string, number>;

export class MaintenanceWorker {
  private readonly worker: Worker<unknown, MaintenanceResult>;

  constructor(
    redisClient: Redis,
    private readonly leadImportMaintenance: ILeadImportMaintenanceService,
    private readonly notificationService: INotificationService,
  ) {
    this.worker = new Worker<unknown, MaintenanceResult>(MAINTENANCE_QUEUE_NAME, this.runMaintenanceJob, {
      connection: redisClient,
      concurrency: 1,
    });
    this.worker.on('completed', (job, result) => this.logMaintenanceResult(job, result));
    this.worker.on('failed', (job, error) => console.error(`Manutenção ${job?.name} falhou: ${error.message}`));
    this.worker.on('error', (error) => console.error(`Worker de manutenção: ${error.message}`));
  }

  async close(): Promise<void> {
    await this.worker.close();
  }

  private runMaintenanceJob = async (job: Job): Promise<MaintenanceResult> => {
    if (job.name === RECONCILE_LEAD_IMPORTS_JOB_NAME) return { ...(await this.leadImportMaintenance.reconcileStuckLeadImports()) };
    if (job.name === EXPIRE_FAILED_LEAD_IMPORTS_JOB_NAME) return { ...(await this.leadImportMaintenance.expireFailedLeadImports()) };
    if (job.name === DELETE_OLD_READ_NOTIFICATIONS_JOB_NAME) {
      return { deletedNotifications: await this.notificationService.deleteOldReadNotifications() };
    }
    throw new Error(`Tarefa de manutenção desconhecida: ${job.name}`);
  };

  private logMaintenanceResult(job: Job, result: MaintenanceResult): void {
    const changedSomething = Object.values(result).some((quantity) => quantity > 0);
    if (changedSomething) console.log(`Manutenção ${job.name}: ${JSON.stringify(result)}`);
  }
}
