import { env } from '@/config/env';
import { SystemClock } from '@/infra/clock';
import { RedisRealtimePublisher } from '@/infra/realtime-events';
import { createWorkerRedisClient } from '@/infra/redis-connection';
import { BullMqLeadImportQueue } from '@/queues/lead-import.queue';
import { MaintenanceScheduler } from '@/queues/maintenance.queue';
import { createDatabaseClient } from '@/repositories/database-client';
import { LeadImportRepository } from '@/repositories/lead-import.repository';
import { NotificationRepository } from '@/repositories/notification.repository';
import { PipelineRepository } from '@/repositories/pipeline.repository';
import { LeadImportMaintenanceService } from '@/services/lead-import-maintenance.service';
import { LeadImportNotificationService } from '@/services/lead-import-notification.service';
import { LeadImportProcessingService } from '@/services/lead-import-processing.service';
import { NotificationService } from '@/services/notification.service';
import { PipelineChangeAnnouncer } from '@/services/pipeline-change-announcer';
import { LeadImportWorker } from '@/workers/lead-import.worker';
import { MaintenanceWorker } from '@/workers/maintenance.worker';

export const prisma = createDatabaseClient(env.DATABASE_URL);
export const workerRedisClient = createWorkerRedisClient(env.REDIS_URL);

const clock = new SystemClock();
const realtimePublisher = new RedisRealtimePublisher(workerRedisClient);
const leadImportRepository = new LeadImportRepository(prisma);
const notificationRepository = new NotificationRepository(prisma);
const pipelineRepository = new PipelineRepository(prisma);
export const leadImportQueue = new BullMqLeadImportQueue(workerRedisClient, {
  attempts: env.LEAD_IMPORT_JOB_ATTEMPTS,
  retryDelayMs: env.LEAD_IMPORT_RETRY_DELAY_MS,
});

const notificationService = new NotificationService(notificationRepository, realtimePublisher, clock, {
  readRetentionDays: env.NOTIFICATION_READ_RETENTION_DAYS,
});
const leadImportNotificationService = new LeadImportNotificationService(notificationService, {
  businessTimeZone: env.APP_TIME_ZONE,
  failedRetentionDays: env.LEAD_IMPORT_FAILED_RETENTION_DAYS,
});
const leadImportProcessingService = new LeadImportProcessingService(
  leadImportRepository,
  leadImportNotificationService,
  realtimePublisher,
  new PipelineChangeAnnouncer(pipelineRepository, realtimePublisher),
  clock,
  { chunkSize: env.LEAD_IMPORT_CHUNK_SIZE },
);
const leadImportMaintenanceService = new LeadImportMaintenanceService(
  leadImportRepository,
  leadImportQueue,
  leadImportProcessingService,
  leadImportNotificationService,
  clock,
  { staleAfterMinutes: env.LEAD_IMPORT_STALE_AFTER_MINUTES, failedRetentionDays: env.LEAD_IMPORT_FAILED_RETENTION_DAYS },
);

export const leadImportWorker = new LeadImportWorker(
  workerRedisClient,
  leadImportProcessingService,
  env.LEAD_IMPORT_WORKER_CONCURRENCY,
);
export const maintenanceScheduler = new MaintenanceScheduler(workerRedisClient, {
  reconcileLeadImportsEveryMs: env.LEAD_IMPORT_RECONCILE_EVERY_MS,
  dailyMaintenanceCron: env.MAINTENANCE_CRON,
  businessTimeZone: env.APP_TIME_ZONE,
});
export const maintenanceWorker = new MaintenanceWorker(workerRedisClient, leadImportMaintenanceService, notificationService);
