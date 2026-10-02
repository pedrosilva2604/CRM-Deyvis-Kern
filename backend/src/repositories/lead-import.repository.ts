import { LeadImportStatus, Prisma } from '@prisma/client';
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
import { CARD_POSITION_GAP, lockStagesForCardPlacement } from '@/repositories/pipeline-card.repository';

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

interface LeadContactRecord {
  phone: string;
  email: string | null;
}

interface DeletedLeadContactRecord extends LeadContactRecord {
  id: string;
}

interface DeletedLeadOfRow {
  deletedLeadId: string;
  currentPhone: string;
  currentPhoneConfirmed: boolean;
  newPhone: { phone: string; phoneCountry: string | null } | null;
}

interface RowsHeldByDeletedLeads {
  rowCount: number;
  deletedLeads: DeletedLeadOfRow[];
}

interface PipelinePlacement {
  addedToPipelineLeads: number;
  alreadyInPipelineLeads: number;
}

const NOTHING_PLACED_IN_PIPELINE: PipelinePlacement = { addedToPipelineLeads: 0, alreadyInPipelineLeads: 0 };

function holdsContactOf(lead: LeadContactRecord, row: LeadImportRowToProcess): boolean {
  return lead.phone === row.phone || (row.email !== null && lead.email === row.email);
}

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
    const leadImport = await this.prisma.leadImport.findUnique({
      where: { id: importId },
      include: { requestedBy: { select: { role: true } } },
    });
    return leadImport ? toLeadImportToProcess(leadImport, leadImport.requestedBy?.role ?? null) : null;
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
    restoresDeletedLeads,
    destination,
    addedById,
    leadsToCreate,
  }: LeadImportChunk): Promise<LeadImportChunkResult> {
    return await this.prisma.$transaction(async (transaction) => {
      const insertedLeads = await transaction.lead.createManyAndReturn({
        data: leadsToCreate,
        skipDuplicates: true,
        select: { phone: true },
      });
      const insertedPhones = new Set(insertedLeads.map((insertedLead) => insertedLead.phone));
      const rowsNotInserted = leadsToCreate.filter((row) => !insertedPhones.has(row.phone));
      const rowsHeldByDeletedLeads = await this.findDeletedLeadsHoldingRows(
        transaction,
        rowsNotInserted,
        insertedPhones,
        restoresDeletedLeads,
      );
      if (restoresDeletedLeads) await this.restoreDeletedLeads(transaction, importId, rowsHeldByDeletedLeads.deletedLeads);
      const pipelinePlacement = destination
        ? await this.placeLeadsOfRowsInPipeline(transaction, destination, leadsToCreate, addedById)
        : NOTHING_PLACED_IN_PIPELINE;

      const chunkResult: LeadImportChunkResult = {
        insertedLeads: insertedLeads.length,
        restoredLeads: restoresDeletedLeads ? rowsHeldByDeletedLeads.deletedLeads.length : 0,
        skippedDeletedLeads: restoresDeletedLeads ? 0 : rowsHeldByDeletedLeads.rowCount,
        ...pipelinePlacement,
      };
      const advanced = await transaction.leadImport.updateMany({
        where: { id: importId, status: LeadImportStatus.PROCESSING, processedRows: processedRowsBefore },
        data: {
          processedRows: processedRowsBefore + leadsToCreate.length,
          importedLeads: { increment: chunkResult.insertedLeads },
          skippedExistingLeads: {
            increment: rowsNotInserted.length - chunkResult.restoredLeads - chunkResult.skippedDeletedLeads,
          },
          restoredLeads: { increment: chunkResult.restoredLeads },
          skippedDeletedLeads: { increment: chunkResult.skippedDeletedLeads },
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

  private async findDeletedLeadsHoldingRows(
    transaction: DatabaseTransaction,
    rowsNotInserted: LeadImportRowToProcess[],
    insertedPhones: Set<string>,
    locksDeletedLeads: boolean,
  ): Promise<RowsHeldByDeletedLeads> {
    if (rowsNotInserted.length === 0) return { rowCount: 0, deletedLeads: [] };
    const phones = rowsNotInserted.map((row) => row.phone);
    const emails = rowsNotInserted.flatMap((row) => (row.email ? [row.email] : []));
    const activeLeads = await transaction.lead.findMany({
      where: { deletedAt: null, OR: [{ phone: { in: phones } }, { email: { in: emails } }] },
      select: { phone: true, email: true },
    });
    const deletedLeads = await transaction.$queryRaw<DeletedLeadContactRecord[]>`
      SELECT "id", "phone", "email" FROM "Lead"
      WHERE "deletedAt" IS NOT NULL AND ("phone" = ANY(${phones}::text[]) OR "email" = ANY(${emails}::text[]))
      ORDER BY "phone" ${locksDeletedLeads ? Prisma.sql`FOR UPDATE` : Prisma.empty}`;
    const phonesInUse = new Set([...insertedPhones, ...activeLeads.map((lead) => lead.phone), ...deletedLeads.map((lead) => lead.phone)]);

    const deletedLeadById = new Map<string, DeletedLeadOfRow>();
    let rowCount = 0;
    for (const row of rowsNotInserted) {
      if (activeLeads.some((activeLead) => holdsContactOf(activeLead, row))) continue;
      const deletedLead =
        deletedLeads.find((candidate) => candidate.phone === row.phone) ??
        deletedLeads.find((candidate) => row.email !== null && candidate.email === row.email);
      if (!deletedLead) continue;
      rowCount += 1;
      const alreadyFound = deletedLeadById.get(deletedLead.id);
      const currentPhoneConfirmed = (alreadyFound?.currentPhoneConfirmed ?? false) || row.phone === deletedLead.phone;
      const bringsNewFreePhone = row.phone !== deletedLead.phone && !phonesInUse.has(row.phone);
      const newPhoneOfRow = bringsNewFreePhone ? { phone: row.phone, phoneCountry: row.phoneCountry } : null;
      deletedLeadById.set(deletedLead.id, {
        deletedLeadId: deletedLead.id,
        currentPhone: deletedLead.phone,
        currentPhoneConfirmed,
        newPhone: currentPhoneConfirmed ? null : (newPhoneOfRow ?? alreadyFound?.newPhone ?? null),
      });
    }
    return { rowCount, deletedLeads: [...deletedLeadById.values()] };
  }

  private async restoreDeletedLeads(
    transaction: DatabaseTransaction,
    importId: string,
    deletedLeadsOfRows: DeletedLeadOfRow[],
  ): Promise<void> {
    for (const { deletedLeadId, currentPhone, newPhone } of deletedLeadsOfRows) {
      const keepsCurrentPhone = newPhone === null || (await this.isPhoneInSpreadsheet(transaction, importId, currentPhone));
      await transaction.lead.update({
        where: { id: deletedLeadId },
        data: { deletedAt: null, ...(keepsCurrentPhone ? {} : newPhone) },
      });
    }
  }

  private async placeLeadsOfRowsInPipeline(
    transaction: DatabaseTransaction,
    { pipelineId, stageId }: LeadImportDestination,
    rows: LeadImportRowToProcess[],
    addedById: string | null,
  ): Promise<PipelinePlacement> {
    const leadIdsOfRows = await this.findActiveLeadIdsOfRows(transaction, rows);
    if (leadIdsOfRows.length === 0) return NOTHING_PLACED_IN_PIPELINE;
    await lockStagesForCardPlacement(transaction, [stageId]);
    const firstCard = await transaction.pipelineCard.findFirst({ where: { stageId }, orderBy: { position: 'asc' }, select: { position: true } });
    const topPosition = firstCard?.position ?? 0;
    const placement = await transaction.pipelineCard.createMany({
      data: leadIdsOfRows.map((leadId, leadIndex) => ({
        pipelineId,
        stageId,
        leadId,
        addedById,
        position: topPosition - CARD_POSITION_GAP * (leadIndex + 1),
      })),
      skipDuplicates: true,
    });
    return { addedToPipelineLeads: placement.count, alreadyInPipelineLeads: leadIdsOfRows.length - placement.count };
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

  private async isPhoneInSpreadsheet(transaction: DatabaseTransaction, importId: string, phone: string): Promise<boolean> {
    return (await transaction.leadImportRow.count({ where: { leadImportId: importId, phone } })) > 0;
  }

  private async findFinishedLeadImport(importId: string, finishedAt: Date): Promise<FinishedLeadImport | null> {
    const leadImport = await this.prisma.leadImport.findUnique({ where: { id: importId } });
    return leadImport ? toFinishedLeadImport(leadImport, finishedAt) : null;
  }
}
