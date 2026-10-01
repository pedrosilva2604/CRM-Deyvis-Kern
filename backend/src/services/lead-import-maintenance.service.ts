import type { Clock } from '@/infra/clock';
import type { ILeadImportQueue } from '@/queues/lead-import.queue';
import type { ILeadImportRepository } from '@/repositories/lead-import.repository';
import type { ILeadImportNotificationService } from './lead-import-notification.service';
import type { ILeadImportProcessingService } from './lead-import-processing.service';

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const WARN_DAYS_BEFORE_EXPIRY = 1;
const RETRIES_EXHAUSTED_REASON = 'As tentativas automáticas acabaram e a importação não foi marcada como falha a tempo';

export interface LeadImportMaintenanceSettings {
  staleAfterMinutes: number;
  failedRetentionDays: number;
}

export interface LeadImportReconciliation {
  requeuedImports: number;
  importsMarkedAsFailed: number;
}

export interface LeadImportCleanup {
  expiredImports: number;
  warnedImports: number;
}

export interface ILeadImportMaintenanceService {
  reconcileStuckLeadImports(): Promise<LeadImportReconciliation>;
  expireFailedLeadImports(): Promise<LeadImportCleanup>;
}

export class LeadImportMaintenanceService implements ILeadImportMaintenanceService {
  constructor(
    private readonly leadImportRepository: ILeadImportRepository,
    private readonly leadImportQueue: ILeadImportQueue,
    private readonly leadImportProcessing: ILeadImportProcessingService,
    private readonly leadImportNotifications: ILeadImportNotificationService,
    private readonly clock: Clock,
    private readonly settings: LeadImportMaintenanceSettings,
  ) {}

  async reconcileStuckLeadImports(): Promise<LeadImportReconciliation> {
    const staleBefore = new Date(this.clock.now().getTime() - this.settings.staleAfterMinutes * MINUTE_MS);
    const requeuedPendingImports = await this.requeuePendingImportsWithoutJob(staleBefore);
    const processingReconciliation = await this.reconcileProcessingImportsWithoutJob(staleBefore);
    return {
      requeuedImports: requeuedPendingImports + processingReconciliation.requeuedImports,
      importsMarkedAsFailed: processingReconciliation.importsMarkedAsFailed,
    };
  }

  async expireFailedLeadImports(): Promise<LeadImportCleanup> {
    const expiredImports = await this.expireImportsPastRetention();
    const warnedImports = await this.warnImportsExpiringSoon();
    return { expiredImports, warnedImports };
  }

  private async requeuePendingImportsWithoutJob(staleBefore: Date): Promise<number> {
    let requeuedImports = 0;
    for (const importId of await this.leadImportRepository.findStalePendingImportIds(staleBefore)) {
      if ((await this.leadImportQueue.findLeadImportJobState(importId)) === 'scheduled') continue;
      await this.leadImportQueue.requeueLeadImport(importId);
      requeuedImports += 1;
    }
    return requeuedImports;
  }

  private async reconcileProcessingImportsWithoutJob(staleBefore: Date): Promise<LeadImportReconciliation> {
    const reconciliation: LeadImportReconciliation = { requeuedImports: 0, importsMarkedAsFailed: 0 };
    for (const importId of await this.leadImportRepository.findStaleProcessingImportIds(staleBefore)) {
      const jobState = await this.leadImportQueue.findLeadImportJobState(importId);
      if (jobState === 'scheduled') continue;
      if (jobState === 'failed') {
        await this.leadImportProcessing.markLeadImportAsFailed(importId, RETRIES_EXHAUSTED_REASON);
        reconciliation.importsMarkedAsFailed += 1;
        continue;
      }
      await this.leadImportQueue.requeueLeadImport(importId);
      reconciliation.requeuedImports += 1;
    }
    return reconciliation;
  }

  private async expireImportsPastRetention(): Promise<number> {
    const expireFinishedBefore = this.daysAgo(this.settings.failedRetentionDays);
    let expiredImports = 0;
    for (const importId of await this.leadImportRepository.findFailedImportIdsFinishedBefore(expireFinishedBefore, false)) {
      const expiredImport = await this.leadImportRepository.expireLeadImport(importId);
      if (!expiredImport) continue;
      await this.leadImportNotifications.notifyImportExpired(expiredImport);
      expiredImports += 1;
    }
    return expiredImports;
  }

  private async warnImportsExpiringSoon(): Promise<number> {
    const warnFinishedBefore = this.daysAgo(this.settings.failedRetentionDays - WARN_DAYS_BEFORE_EXPIRY);
    let warnedImports = 0;
    for (const importId of await this.leadImportRepository.findFailedImportIdsFinishedBefore(warnFinishedBefore, true)) {
      const warnedImport = await this.leadImportRepository.markExpiryWarningSent(importId, this.clock.now());
      if (!warnedImport) continue;
      await this.leadImportNotifications.notifyImportExpiring(warnedImport);
      warnedImports += 1;
    }
    return warnedImports;
  }

  private daysAgo(days: number): Date {
    return new Date(this.clock.now().getTime() - days * DAY_MS);
  }
}
