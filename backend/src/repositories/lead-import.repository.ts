import { LeadImportStatus } from '@prisma/client';
import {
  toFinishedLeadImport,
  toLeadImportProgress,
  toLeadImportToProcess,
  type CreateLeadImportData,
  type FinishedLeadImport,
  type LeadImportChunk,
  type LeadImportProgress,
  type LeadImportRowToProcess,
  type LeadImportToProcess,
} from '@/models/lead-import.model';
import type { DatabaseClient } from '@/repositories/database-client';

export interface ILeadImportRepository {
  createLeadImport(newLeadImport: CreateLeadImportData): Promise<string>;
  findLeadImportProgress(importId: string, requestedById: string | null): Promise<LeadImportProgress | null>;
  hasRunningLeadImport(requestedById: string): Promise<boolean>;
  startLeadImport(importId: string, startedAt: Date): Promise<LeadImportToProcess | null>;
  findNextRowsToProcess(importId: string, alreadyProcessedRows: number, chunkSize: number): Promise<LeadImportRowToProcess[]>;
  importChunk(chunk: LeadImportChunk): Promise<number>;
  completeLeadImport(importId: string, finishedAt: Date): Promise<FinishedLeadImport | null>;
  failLeadImport(importId: string, failureReason: string, finishedAt: Date): Promise<FinishedLeadImport | null>;
  findStalePendingImportIds(createdBefore: Date): Promise<string[]>;
  findStaleProcessingImportIds(startedBefore: Date): Promise<string[]>;
  findFailedImportIdsFinishedBefore(finishedBefore: Date, onlyNotWarned: boolean): Promise<string[]>;
  expireLeadImport(importId: string): Promise<FinishedLeadImport | null>;
  markExpiryWarningSent(importId: string, sentAt: Date): Promise<FinishedLeadImport | null>;
}

const RUNNING_LEAD_IMPORT_STATUSES = [LeadImportStatus.PENDING, LeadImportStatus.PROCESSING];

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

  async importChunk({ importId, processedRowsBefore, leadsToCreate }: LeadImportChunk): Promise<number> {
    return await this.prisma.$transaction(async (transaction) => {
      const insertion = await transaction.lead.createMany({ data: leadsToCreate, skipDuplicates: true });
      const advanced = await transaction.leadImport.updateMany({
        where: { id: importId, status: LeadImportStatus.PROCESSING, processedRows: processedRowsBefore },
        data: {
          processedRows: processedRowsBefore + leadsToCreate.length,
          importedLeads: { increment: insertion.count },
          skippedExistingLeads: { increment: leadsToCreate.length - insertion.count },
        },
      });
      if (advanced.count === 0) throw new LeadImportChunkAlreadyProcessedError(importId);
      return insertion.count;
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

  private async findFinishedLeadImport(importId: string, finishedAt: Date): Promise<FinishedLeadImport | null> {
    const leadImport = await this.prisma.leadImport.findUnique({ where: { id: importId } });
    return leadImport ? toFinishedLeadImport(leadImport, finishedAt) : null;
  }
}
