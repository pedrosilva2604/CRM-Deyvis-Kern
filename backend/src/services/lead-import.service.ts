import { LeadImportStatus, Role } from '@prisma/client';
import { readLeadSpreadsheet, type LeadSpreadsheetContent, type LeadSpreadsheetRowToImport } from '@crm/shared';
import { BadRequestError, ConflictError, NotFoundError } from '@/errors/app-errors';
import { LEAD_IMPORT_ERRORS } from '@/errors/errors.constants';
import type { BusinessCalendar } from '@/infra/business-calendar';
import type { LoggedUserContext } from '@/models/common.model';
import type {
  LeadImportProgress,
  LeadImportProgressRequest,
  LeadImportReceipt,
  LeadImportRetryRequest,
  LeadImportRowData,
} from '@/models/lead-import.model';
import type { ILeadImportQueue } from '@/queues/lead-import.queue';
import type { ILeadImportRepository } from '@/repositories/lead-import.repository';
import type { IPipelineRepository, StageLocation } from '@/repositories/pipeline.repository';
import type { IAuditService } from './audit.service';

export interface LeadImportLimits {
  maximumRows: number;
}

export interface ILeadImportService {
  requestLeadImport(csvText: string, loggedUserContext: LoggedUserContext): Promise<LeadImportReceipt>;
  getLeadImportProgress(request: LeadImportProgressRequest, loggedUserContext: LoggedUserContext): Promise<LeadImportProgress>;
  retryLeadImport(request: LeadImportRetryRequest, loggedUserContext: LoggedUserContext): Promise<void>;
}

export class LeadImportService implements ILeadImportService {
  constructor(
    private readonly leadImportRepository: ILeadImportRepository,
    private readonly pipelineRepository: IPipelineRepository,
    private readonly leadImportQueue: ILeadImportQueue,
    private readonly audit: IAuditService,
    private readonly businessCalendar: BusinessCalendar,
    private readonly limits: LeadImportLimits,
  ) {}

  async requestLeadImport(csvText: string, loggedUserContext: LoggedUserContext): Promise<LeadImportReceipt> {
    await this.assertNoRunningImport(loggedUserContext.loggedUser.id);
    const spreadsheetContent = this.readSpreadsheetOrFail(csvText);
    const receivingStage = await this.findStageToReceiveLeadsOrFail();
    const importId = await this.leadImportRepository.createLeadImport({
      totalRows: spreadsheetContent.totalRows,
      invalidRows: spreadsheetContent.invalidRows.length,
      duplicateRowsInFile: spreadsheetContent.duplicateRows.length,
      pipelineId: receivingStage.pipelineId,
      stageId: receivingStage.stageId,
      requestedById: loggedUserContext.loggedUser.id,
      rows: spreadsheetContent.rowsToImport.map((row) => this.toLeadImportRowData(row)),
    });
    await this.recordImportRequested(loggedUserContext, importId, spreadsheetContent);
    await this.enqueueOrLeaveForReconciler(importId);
    return { importId };
  }

  async getLeadImportProgress(
    { targetImportId }: LeadImportProgressRequest,
    loggedUserContext: LoggedUserContext,
  ): Promise<LeadImportProgress> {
    return await this.findVisibleLeadImportOrFail(targetImportId, loggedUserContext);
  }

  async retryLeadImport({ targetImportId }: LeadImportRetryRequest, loggedUserContext: LoggedUserContext): Promise<void> {
    const leadImport = await this.findVisibleLeadImportOrFail(targetImportId, loggedUserContext);
    if (leadImport.status !== LeadImportStatus.FAILED) throw new ConflictError(LEAD_IMPORT_ERRORS.NOT_RETRYABLE);
    const wasReopened = await this.reopenExplainingWhoHasRunningImport(targetImportId, loggedUserContext);
    if (!wasReopened) throw new ConflictError(LEAD_IMPORT_ERRORS.NOT_RETRYABLE);

    await this.audit.recordAuditLog(loggedUserContext, {
      action: 'lead.import_retry_requested',
      entity: 'LeadImport',
      entityId: targetImportId,
      details: { processedRows: leadImport.processedRows, rowsToImport: leadImport.rowsToImport },
    });
    await this.leaveForReconcilerIfQueueFails(targetImportId, () => this.leadImportQueue.requeueLeadImport(targetImportId));
  }

  private async reopenExplainingWhoHasRunningImport(importId: string, { loggedUser }: LoggedUserContext): Promise<boolean> {
    try {
      return await this.leadImportRepository.reopenFailedLeadImport(importId);
    } catch (error) {
      const isRequesterBusy = error instanceof ConflictError && error.message === LEAD_IMPORT_ERRORS.ALREADY_RUNNING;
      const isRetriedByRequester = (await this.leadImportRepository.findLeadImportProgress(importId, loggedUser.id)) !== null;
      if (isRequesterBusy && !isRetriedByRequester) throw new ConflictError(LEAD_IMPORT_ERRORS.REQUESTER_HAS_RUNNING_IMPORT);
      throw error;
    }
  }

  private async findVisibleLeadImportOrFail(importId: string, { loggedUser }: LoggedUserContext): Promise<LeadImportProgress> {
    const onlyImportsRequestedBy = loggedUser.role === Role.ADMIN ? null : loggedUser.id;
    const leadImportProgress = await this.leadImportRepository.findLeadImportProgress(importId, onlyImportsRequestedBy);
    if (!leadImportProgress) throw new NotFoundError(LEAD_IMPORT_ERRORS.NOT_FOUND);
    return leadImportProgress;
  }

  private async enqueueOrLeaveForReconciler(importId: string): Promise<void> {
    await this.leaveForReconcilerIfQueueFails(importId, () => this.leadImportQueue.enqueueLeadImport(importId));
  }

  private async leaveForReconcilerIfQueueFails(importId: string, putInQueue: () => Promise<void>): Promise<void> {
    try {
      await putInQueue();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.error(`Importação ${importId} gravada, mas fora da fila por enquanto; o conciliador vai enfileirá-la: ${reason}`);
    }
  }

  private async assertNoRunningImport(requestedById: string): Promise<void> {
    if (await this.leadImportRepository.hasRunningLeadImport(requestedById)) {
      throw new ConflictError(LEAD_IMPORT_ERRORS.ALREADY_RUNNING);
    }
  }

  private readSpreadsheetOrFail(csvText: string): LeadSpreadsheetContent {
    const spreadsheetReading = readLeadSpreadsheet(csvText, this.businessCalendar.todayAsCalendarDate(), this.limits);
    if (spreadsheetReading.status === 'unreadable') throw new BadRequestError(spreadsheetReading.reason);
    if (spreadsheetReading.content.rowsToImport.length === 0) throw new BadRequestError(LEAD_IMPORT_ERRORS.NO_ROWS_TO_IMPORT);
    return spreadsheetReading.content;
  }

  private async findStageToReceiveLeadsOrFail(): Promise<StageLocation> {
    const receivingStage = await this.pipelineRepository.findFirstStageOfFirstPipeline();
    if (!receivingStage) throw new BadRequestError(LEAD_IMPORT_ERRORS.NO_PIPELINE_TO_RECEIVE_LEADS);
    return receivingStage;
  }

  private toLeadImportRowData(row: LeadSpreadsheetRowToImport): LeadImportRowData {
    const enteredOn = row.enteredOn ?? this.businessCalendar.todayAsIsoDate();
    return {
      rowNumber: row.rowNumber,
      name: row.name,
      phone: row.phone,
      phoneCountry: row.phoneCountry,
      email: row.email,
      enteredOn: this.businessCalendar.toDatabaseDate(enteredOn),
    };
  }

  private async recordImportRequested(
    loggedUserContext: LoggedUserContext,
    importId: string,
    spreadsheetContent: LeadSpreadsheetContent,
  ): Promise<void> {
    await this.audit.recordAuditLog(loggedUserContext, {
      action: 'lead.import_requested',
      entity: 'LeadImport',
      entityId: importId,
      details: {
        totalRows: spreadsheetContent.totalRows,
        rowsToImport: spreadsheetContent.rowsToImport.length,
        invalidRows: spreadsheetContent.invalidRows.length,
        duplicateRowsInFile: spreadsheetContent.duplicateRows.length,
      },
    });
  }
}
