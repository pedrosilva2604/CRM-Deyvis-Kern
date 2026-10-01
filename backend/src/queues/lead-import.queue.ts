import { Queue, type JobsOptions } from 'bullmq';
import type { Redis } from 'ioredis';

export const LEAD_IMPORT_QUEUE_NAME = 'lead-imports';
export const IMPORT_LEADS_JOB_NAME = 'import-leads';

const HOUR_IN_SECONDS = 60 * 60;
const KEEP_COMPLETED_JOBS_FOR_SECONDS = 24 * HOUR_IN_SECONDS;
const KEEP_FAILED_JOBS_FOR_SECONDS = 7 * 24 * HOUR_IN_SECONDS;

export interface LeadImportJobData {
  importId: string;
}

export interface LeadImportRetryPolicy {
  attempts: number;
  retryDelayMs: number;
}

export type LeadImportJobState = 'missing' | 'scheduled' | 'failed' | 'finished';

export interface ILeadImportQueue {
  enqueueLeadImport(importId: string): Promise<void>;
  findLeadImportJobState(importId: string): Promise<LeadImportJobState>;
  requeueLeadImport(importId: string): Promise<void>;
  close(): Promise<void>;
}

export class BullMqLeadImportQueue implements ILeadImportQueue {
  private readonly queue: Queue<LeadImportJobData>;

  constructor(redisClient: Redis, retryPolicy: LeadImportRetryPolicy) {
    const defaultJobOptions: JobsOptions = {
      attempts: retryPolicy.attempts,
      backoff: { type: 'exponential', delay: retryPolicy.retryDelayMs },
      removeOnComplete: { age: KEEP_COMPLETED_JOBS_FOR_SECONDS },
      removeOnFail: { age: KEEP_FAILED_JOBS_FOR_SECONDS },
    };
    this.queue = new Queue<LeadImportJobData>(LEAD_IMPORT_QUEUE_NAME, { connection: redisClient, defaultJobOptions });
    this.queue.on('error', (error) => console.error(`Fila de importação indisponível: ${error.message}`));
  }

  async enqueueLeadImport(importId: string): Promise<void> {
    await this.queue.add(IMPORT_LEADS_JOB_NAME, { importId }, { jobId: importId });
  }

  async findLeadImportJobState(importId: string): Promise<LeadImportJobState> {
    const job = await this.queue.getJob(importId);
    if (!job) return 'missing';
    const jobState = await job.getState();
    if (jobState === 'failed') return 'failed';
    if (jobState === 'completed' || jobState === 'unknown') return 'finished';
    return 'scheduled';
  }

  async requeueLeadImport(importId: string): Promise<void> {
    const previousJob = await this.queue.getJob(importId);
    if (previousJob) await previousJob.remove();
    await this.enqueueLeadImport(importId);
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
