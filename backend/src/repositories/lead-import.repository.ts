import { LeadImportStatus } from '@prisma/client';
import {
  toFinishedLeadImport,
  toLeadImportProgress,
  toLeadImportToProcess,
  type CreateLeadImportData,
  type FinishedLeadImport,
  type LeadImportChunk,
  type LeadImportChunkResult,
  type LeadImportDestination,
  type LeadImportProgress,
  type LeadImportRowToProcess,
  type LeadImportToProcess,
} from '@/models/lead-import.model';
import type { DatabaseClient, DatabaseTransaction } from '@/repositories/database-client';
import {
  CARD_POSITION_GAP,
  isOpenStage,
  lockActiveLeadsForCardPlacement,
  lockStagesForCardPlacement,
} from '@/repositories/pipeline-card.repository';

export interface ILeadImportRepository {
  createLeadImport(newLeadImport: CreateLeadImportData): Promise<string>;
  findLeadImportProgress(importId: string, requestedById: string | null): Promise<LeadImportProgress | null>;
  hasRunningLeadImport(requestedById: string): Promise<boolean>;
  startLeadImport(importId: string, startedAt: Date): Promise<LeadImportToProcess | null>;
  findNextRowsToProcess(importId: string, alreadyProcessedRows: number, chunkSize: number): Promise<LeadImportRowToProcess[]>;
  importChunk(chunk: LeadImportChunk): Promise<LeadImportChunkResult>;
  completeLeadImport(importId: string, finishedAt: Date): Promise<FinishedLeadImport | null>;
  failLeadImport(importId: string, failureReason: string, finishedAt: Date): Promise<FinishedLeadImport | null>;
  reopenFailedLeadImport(importId: string): Promise<boolean>;
  findStalePendingImportIds(createdBefore: Date): Promise<string[]>;
  findStaleProcessingImportIds(startedBefore: Date): Promise<string[]>;
  findFailedImportIdsFinishedBefore(finishedBefore: Date, onlyNotWarned: boolean): Promise<string[]>;
  expireLeadImport(importId: string): Promise<FinishedLeadImport | null>;
  markExpiryWarningSent(importId: string, sentAt: Date): Promise<FinishedLeadImport | null>;
}

const RUNNING_LEAD_IMPORT_STATUSES = [LeadImportStatus.PENDING, LeadImportStatus.PROCESSING];

interface PipelinePlacement {
  addedToPipelineLeads: number;
  alreadyInPipelineLeads: number;
}

interface CardsToAddAboveTop {
  destination: LeadImportDestination;
  leadIds: string[];
  addedById: string;
  topPosition: number;
}

const NOTHING_PLACED_IN_PIPELINE: PipelinePlacement = { addedToPipelineLeads: 0, alreadyInPipelineLeads: 0 };

export class LeadImportChunkAlreadyProcessedError extends Error {
  constructor(importId: string) {
    super(`O pedaço da importação ${importId} já foi processado por outra execução`);
  }
}

export class LeadImportRepository implements ILeadImportRepository {
  constructor(private readonly prisma: DatabaseClient) {}

  async createLeadImport({ rows, ...leadImportCounts }: CreateLeadImportData): Promise<string> {
    const createdLeadImport = await this.prisma.leadImport.create({
      data: {
        ...leadImportCounts,
        rowsToImport: rows.length,
        rows: { createMany: { data: rows } },
      },
      select: { id: true },
    });
    return createdLeadImport.id;
  }

  async findLeadImportProgress(importId: string, requestedById: string | null): Promise<LeadImportProgress | null> {
    const leadImport = await this.prisma.leadImport.findFirst({
      where: { id: importId, ...(requestedById !== null && { requestedById }) },
    });
    return leadImport ? toLeadImportProgress(leadImport) : null;
  }

  async hasRunningLeadImport(requestedById: string): Promise<boolean> {
    const runningLeadImports = await this.prisma.leadImport.count({
      where: { requestedById, status: { in: RUNNING_LEAD_IMPORT_STATUSES } },
    });
    return runningLeadImports > 0;
  }

  async startLeadImport(importId: string, startedAt: Date): Promise<LeadImportToProcess | null> {
    const markedAsProcessing = await this.prisma.leadImport.updateMany({
      where: { id: importId, status: { in: RUNNING_LEAD_IMPORT_STATUSES } },
      data: { status: LeadImportStatus.PROCESSING },
    });
    if (markedAsProcessing.count === 0) return null;
    await this.prisma.leadImport.updateMany({ where: { id: importId, startedAt: null }, data: { startedAt } });
    const leadImport = await this.prisma.leadImport.findUnique({ where: { id: importId } });
    return leadImport ? toLeadImportToProcess(leadImport) : null;
  }

  async findNextRowsToProcess(
    importId: string,
    alreadyProcessedRows: number,
    chunkSize: number,
  ): Promise<LeadImportRowToProcess[]> {
    return await this.prisma.leadImportRow.findMany({
      where: { leadImportId: importId },
      orderBy: { rowNumber: 'asc' },
      skip: alreadyProcessedRows,
      take: chunkSize,
      select: { name: true, phone: true, phoneCountry: true, email: true, enteredOn: true },
    });
  }

  async importChunk({
    importId,
    processedRowsBefore,
    destination,
    addedById,
    leadsToCreate,
  }: LeadImportChunk): Promise<LeadImportChunkResult> {
    return await this.prisma.$transaction(async (transaction) => {
      const insertedLeads = await transaction.lead.createMany({ data: leadsToCreate, skipDuplicates: true });
      const pipelinePlacement = destination
        ? await this.placeLeadsOfRowsInPipeline(transaction, destination, leadsToCreate, addedById)
        : NOTHING_PLACED_IN_PIPELINE;

      const chunkResult: LeadImportChunkResult = {
        insertedLeads: insertedLeads.count,
        ...pipelinePlacement,
      };
      const advanced = await transaction.leadImport.updateMany({
        where: { id: importId, status: LeadImportStatus.PROCESSING, processedRows: processedRowsBefore },
        data: {
          processedRows: processedRowsBefore + leadsToCreate.length,
          importedLeads: { increment: chunkResult.insertedLeads },
          skippedExistingLeads: { increment: leadsToCreate.length - chunkResult.insertedLeads },
          addedToPipelineLeads: { increment: chunkResult.addedToPipelineLeads },
          alreadyInPipelineLeads: { increment: chunkResult.alreadyInPipelineLeads },
        },
      });
      if (advanced.count === 0) throw new LeadImportChunkAlreadyProcessedError(importId);
      return chunkResult;
    });
  }

  async completeLeadImport(importId: string, finishedAt: Date): Promise<FinishedLeadImport | null> {
    const [completion] = await this.prisma.$transaction([
      this.prisma.leadImport.updateMany({
        where: { id: importId, status: LeadImportStatus.PROCESSING },
        data: { status: LeadImportStatus.COMPLETED, finishedAt },
      }),
      this.prisma.leadImportRow.deleteMany({
        where: { leadImportId: importId, leadImport: { status: LeadImportStatus.COMPLETED } },
      }),
    ]);
    return completion.count === 0 ? null : await this.findFinishedLeadImport(importId, finishedAt);
  }

  async failLeadImport(importId: string, failureReason: string, finishedAt: Date): Promise<FinishedLeadImport | null> {
    const failure = await this.prisma.leadImport.updateMany({
      where: { id: importId, status: { in: RUNNING_LEAD_IMPORT_STATUSES } },
      data: { status: LeadImportStatus.FAILED, failureReason, finishedAt },
    });
    return failure.count === 0 ? null : await this.findFinishedLeadImport(importId, finishedAt);
  }

  async reopenFailedLeadImport(importId: string): Promise<boolean> {
    const reopening = await this.prisma.leadImport.updateMany({
      where: { id: importId, status: LeadImportStatus.FAILED },
      data: {
        status: LeadImportStatus.PENDING,
        failureReason: null,
        startedAt: null,
        finishedAt: null,
        expiryWarningSentAt: null,
      },
    });
    return reopening.count === 1;
  }

  async findStalePendingImportIds(createdBefore: Date): Promise<string[]> {
    const staleImports = await this.prisma.leadImport.findMany({
      where: { status: LeadImportStatus.PENDING, createdAt: { lt: createdBefore } },
      select: { id: true },
    });
    return staleImports.map(({ id }) => id);
  }

  async findStaleProcessingImportIds(startedBefore: Date): Promise<string[]> {
    const staleImports = await this.prisma.leadImport.findMany({
      where: { status: LeadImportStatus.PROCESSING, startedAt: { lt: startedBefore } },
      select: { id: true },
    });
    return staleImports.map(({ id }) => id);
  }

  async findFailedImportIdsFinishedBefore(finishedBefore: Date, onlyNotWarned: boolean): Promise<string[]> {
    const failedImports = await this.prisma.leadImport.findMany({
      where: {
        status: LeadImportStatus.FAILED,
        finishedAt: { lt: finishedBefore },
        ...(onlyNotWarned && { expiryWarningSentAt: null }),
      },
      select: { id: true },
    });
    return failedImports.map(({ id }) => id);
  }

  async expireLeadImport(importId: string): Promise<FinishedLeadImport | null> {
    const [expiration] = await this.prisma.$transaction([
      this.prisma.leadImport.updateMany({
        where: { id: importId, status: LeadImportStatus.FAILED },
        data: { status: LeadImportStatus.EXPIRED },
      }),
      this.prisma.leadImportRow.deleteMany({ where: { leadImportId: importId, leadImport: { status: LeadImportStatus.EXPIRED } } }),
    ]);
    return expiration.count === 0 ? null : await this.findFinishedLeadImport(importId, new Date());
  }

  async markExpiryWarningSent(importId: string, sentAt: Date): Promise<FinishedLeadImport | null> {
    const warning = await this.prisma.leadImport.updateMany({
      where: { id: importId, status: LeadImportStatus.FAILED, expiryWarningSentAt: null },
      data: { expiryWarningSentAt: sentAt },
    });
    return warning.count === 0 ? null : await this.findFinishedLeadImport(importId, sentAt);
  }

  private async placeLeadsOfRowsInPipeline(
    transaction: DatabaseTransaction,
    destination: LeadImportDestination,
    rows: LeadImportRowToProcess[],
    addedById: string,
  ): Promise<PipelinePlacement> {
    const leadIdsOfRows = await lockActiveLeadsForCardPlacement(transaction, await this.findActiveLeadIdsOfRows(transaction, rows));
    if (leadIdsOfRows.length === 0) return NOTHING_PLACED_IN_PIPELINE;
    const [lockedStage] = await lockStagesForCardPlacement(transaction, [destination.stageId]);
    if (!lockedStage || !isOpenStage(lockedStage)) return NOTHING_PLACED_IN_PIPELINE;
    const topPosition = await this.findTopPositionOfStage(transaction, destination.stageId);
    const addedToPipelineLeads = await this.addCardsAboveTop(transaction, { destination, leadIds: leadIdsOfRows, addedById, topPosition });
    return { addedToPipelineLeads, alreadyInPipelineLeads: leadIdsOfRows.length - addedToPipelineLeads };
  }

  private async findTopPositionOfStage(transaction: DatabaseTransaction, stageId: string): Promise<number> {
    const firstCard = await transaction.pipelineCard.findFirst({ where: { stageId }, orderBy: { position: 'asc' }, select: { position: true } });
    return firstCard?.position ?? 0;
  }

  private async addCardsAboveTop(
    transaction: DatabaseTransaction,
    { destination, leadIds, addedById, topPosition }: CardsToAddAboveTop,
  ): Promise<number> {
    const placement = await transaction.pipelineCard.createMany({
      data: leadIds.map((leadId, leadIndex) => ({
        pipelineId: destination.pipelineId,
        stageId: destination.stageId,
        leadId,
        addedById,
        position: topPosition - CARD_POSITION_GAP * (leadIndex + 1),
      })),
      skipDuplicates: true,
    });
    return placement.count;
  }

  private async findActiveLeadIdsOfRows(transaction: DatabaseTransaction, rows: LeadImportRowToProcess[]): Promise<string[]> {
    const emails = rows.flatMap((row) => (row.email ? [row.email] : []));
    const activeLeads = await transaction.lead.findMany({
      where: { deletedAt: null, OR: [{ phone: { in: rows.map((row) => row.phone) } }, { email: { in: emails } }] },
      select: { id: true, phone: true, email: true },
    });
    const leadIds = new Set<string>();
    for (const row of rows) {
      const leadOfRow =
        activeLeads.find((lead) => lead.phone === row.phone) ??
        activeLeads.find((lead) => row.email !== null && lead.email === row.email);
      if (leadOfRow) leadIds.add(leadOfRow.id);
    }
    return [...leadIds].sort();
  }

  private async findFinishedLeadImport(importId: string, finishedAt: Date): Promise<FinishedLeadImport | null> {
    const leadImport = await this.prisma.leadImport.findUnique({ where: { id: importId } });
    return leadImport ? toFinishedLeadImport(leadImport, finishedAt) : null;
  }
}
