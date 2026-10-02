import { Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import { logFailure } from '@/infra/technical-error';
import type { LeadImportCounters } from '@/models/lead-import.model';
import { LEAD_IMPORT_QUEUE_NAME, type LeadImportJobData } from '@/queues/lead-import.queue';
import type {
  ILeadImportProcessingService,
  LeadImportProcessingOutcome,
} from '@/services/lead-import-processing.service';

export class LeadImportWorker {
  private readonly worker: Worker<LeadImportJobData, LeadImportProcessingOutcome>;

  constructor(
    redisClient: Redis,
    private readonly leadImportProcessingService: ILeadImportProcessingService,
    concurrency: number,
  ) {
    this.worker = new Worker<LeadImportJobData, LeadImportProcessingOutcome>(LEAD_IMPORT_QUEUE_NAME, this.processJob, {
      connection: redisClient,
      concurrency,
    });
    this.worker.on('failed', (job, error) => void this.handleFailedAttempt(job, error));
    this.worker.on('error', (error) => console.error(`Worker de importação: ${error.message}`));
  }

  async close(): Promise<void> {
    await this.worker.close();
  }

  private processJob = async (job: Job<LeadImportJobData>): Promise<LeadImportProcessingOutcome> => {
    return await this.leadImportProcessingService.processLeadImport(job.data.importId, (counters) =>
      this.reportProgress(job, counters),
    );
  };

  private async reportProgress(job: Job<LeadImportJobData>, counters: LeadImportCounters): Promise<void> {
    try {
      await job.updateProgress({ ...counters });
    } catch (error) {
      console.error(`Progresso da importação ${job.data.importId} não enviado: ${(error as Error).message}`);
    }
  }

  private async handleFailedAttempt(job: Job<LeadImportJobData> | undefined, error: Error): Promise<void> {
    logFailure(
      { worker: 'lead-import', importId: job?.data.importId, attempt: job?.attemptsMade, maximumAttempts: job?.opts.attempts },
      error,
    );
    if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
    try {
      await this.leadImportProcessingService.markLeadImportAsFailed(job.data.importId, error.message);
    } catch (markingError) {
      console.error(`Importação ${job.data.importId} falhou e não pôde ser marcada como FAILED: ${(markingError as Error).message}`);
    }
  }
}
