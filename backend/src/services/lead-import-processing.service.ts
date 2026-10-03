import type { Clock } from '@/infra/clock';
import { REALTIME_EVENTS, type IRealtimePublisher } from '@/infra/realtime-events';
import type {
  LeadImportChunk,
  LeadImportCounters,
  LeadImportRowToProcess,
  LeadImportToProcess,
} from '@/models/lead-import.model';
import type { ILeadImportRepository } from '@/repositories/lead-import.repository';
import type { ILeadImportNotificationService } from './lead-import-notification.service';
import type { IPipelineChangeAnnouncer } from './pipeline-change-announcer';

export type ReportLeadImportProgress = (counters: LeadImportCounters) => Promise<void>;

export type LeadImportProcessingOutcome =
  | { outcome: 'completed'; counters: LeadImportCounters }
  | { outcome: 'discarded' };

export interface LeadImportProcessingSettings {
  chunkSize: number;
}

export interface ILeadImportProcessingService {
  processLeadImport(importId: string, reportProgress: ReportLeadImportProgress): Promise<LeadImportProcessingOutcome>;
  markLeadImportAsFailed(importId: string, failureReason: string): Promise<void>;
}

export class LeadImportProcessingService implements ILeadImportProcessingService {
  constructor(
    private readonly leadImportRepository: ILeadImportRepository,
    private readonly leadImportNotifications: ILeadImportNotificationService,
    private readonly realtimePublisher: IRealtimePublisher,
    private readonly pipelineChanges: IPipelineChangeAnnouncer,
    private readonly clock: Clock,
    private readonly settings: LeadImportProcessingSettings,
  ) {}

  async processLeadImport(importId: string, reportProgress: ReportLeadImportProgress): Promise<LeadImportProcessingOutcome> {
    const leadImport = await this.leadImportRepository.startLeadImport(importId, this.clock.now());
    if (!leadImport) return { outcome: 'discarded' };

    let counters = this.readCounters(leadImport);
    let nextRows = await this.findNextRows(importId, counters.processedRows);
    while (nextRows.length > 0) {
      counters = await this.importRows(leadImport, counters, nextRows);
      await reportProgress(counters);
      await this.publishProgressToRequester(leadImport, counters);
      if (leadImport.destination) await this.pipelineChanges.announce(leadImport.destination.pipelineId);
      nextRows = await this.findNextRows(importId, counters.processedRows);
    }

    const completedImport = await this.leadImportRepository.completeLeadImport(importId, this.clock.now());
    if (completedImport) await this.leadImportNotifications.notifyImportCompleted(completedImport);
    return { outcome: 'completed', counters };
  }

  async markLeadImportAsFailed(importId: string, failureReason: string): Promise<void> {
    const failedImport = await this.leadImportRepository.failLeadImport(importId, failureReason, this.clock.now());
    if (failedImport) await this.leadImportNotifications.notifyImportFailed(failedImport);
  }

  private async publishProgressToRequester(leadImport: LeadImportToProcess, counters: LeadImportCounters): Promise<void> {
    await this.realtimePublisher.publishToUser(leadImport.requestedById, REALTIME_EVENTS.LEAD_IMPORT_PROGRESS, {
      importId: leadImport.importId,
      ...counters,
    });
  }

  private readCounters(leadImport: LeadImportToProcess): LeadImportCounters {
    return {
      rowsToImport: leadImport.rowsToImport,
      processedRows: leadImport.processedRows,
      importedLeads: leadImport.importedLeads,
      skippedExistingLeads: leadImport.skippedExistingLeads,
      addedToPipelineLeads: leadImport.addedToPipelineLeads,
      alreadyInPipelineLeads: leadImport.alreadyInPipelineLeads,
    };
  }

  private async findNextRows(importId: string, alreadyProcessedRows: number): Promise<LeadImportRowToProcess[]> {
    return await this.leadImportRepository.findNextRowsToProcess(importId, alreadyProcessedRows, this.settings.chunkSize);
  }

  private async importRows(
    leadImport: LeadImportToProcess,
    counters: LeadImportCounters,
    rows: LeadImportRowToProcess[],
  ): Promise<LeadImportCounters> {
    const chunkResult = await this.leadImportRepository.importChunk(this.buildChunk(leadImport, counters, rows));
    const skippedExistingLeads = rows.length - chunkResult.insertedLeads;
    return {
      rowsToImport: counters.rowsToImport,
      processedRows: counters.processedRows + rows.length,
      importedLeads: counters.importedLeads + chunkResult.insertedLeads,
      skippedExistingLeads: counters.skippedExistingLeads + skippedExistingLeads,
      addedToPipelineLeads: counters.addedToPipelineLeads + chunkResult.addedToPipelineLeads,
      alreadyInPipelineLeads: counters.alreadyInPipelineLeads + chunkResult.alreadyInPipelineLeads,
    };
  }

  private buildChunk(
    leadImport: LeadImportToProcess,
    counters: LeadImportCounters,
    rows: LeadImportRowToProcess[],
  ): LeadImportChunk {
    const rowsInLockOrder = [...rows].sort((firstRow, secondRow) => firstRow.phone.localeCompare(secondRow.phone));
    return {
      importId: leadImport.importId,
      processedRowsBefore: counters.processedRows,
      destination: leadImport.destination,
      addedById: leadImport.requestedById,
      leadsToCreate: rowsInLockOrder,
    };
  }
}
