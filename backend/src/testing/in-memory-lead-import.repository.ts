import type { LeadImportStatus } from '@prisma/client';
import { ConflictError } from '@/errors/app-errors';
import { LEAD_IMPORT_ERRORS } from '@/errors/errors.constants';
import { LeadImportChunkAlreadyProcessedError, type ILeadImportRepository } from '@/repositories/lead-import.repository';
import type {
  CreateLeadImportData,
  FinishedLeadImport,
  LeadImportChunk,
  LeadImportProgress,
  LeadImportRowToProcess,
  LeadImportToProcess,
} from '@/models/lead-import.model';

export interface StoredLeadImport {
  importId: string;
  status: LeadImportStatus;
  requestedById: string | null;
  pipelineId: string;
  stageId: string;
  rows: LeadImportRowToProcess[];
  totalRows: number;
  invalidRows: number;
  duplicateRowsInFile: number;
  rowsToImport: number;
  processedRows: number;
  importedLeads: number;
  skippedExistingLeads: number;
  failureReason: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  expiryWarningSentAt: Date | null;
}

type NewStoredLeadImport = Partial<StoredLeadImport> & { importId: string };

const RUNNING_STATUSES: LeadImportStatus[] = ['PENDING', 'PROCESSING'];

export class InMemoryLeadImportRepository implements ILeadImportRepository {
  readonly phonesAlreadyInCrm = new Set<string>();
  readonly phonesOfEachReceivedChunk: string[][] = [];
  private readonly storedImports = new Map<string, StoredLeadImport>();
  private createdImports = 0;

  add(newLeadImport: NewStoredLeadImport): StoredLeadImport {
    const rows = newLeadImport.rows ?? [];
    const storedImport: StoredLeadImport = {
      status: 'PENDING',
      requestedById: 'usuario-que-importou',
      pipelineId: 'funil-padrao',
      stageId: 'primeira-etapa',
      totalRows: rows.length,
      invalidRows: 0,
      duplicateRowsInFile: 0,
      rowsToImport: rows.length,
      processedRows: 0,
      importedLeads: 0,
      skippedExistingLeads: 0,
      failureReason: null,
      createdAt: new Date(),
      startedAt: null,
      finishedAt: null,
      expiryWarningSentAt: null,
      ...newLeadImport,
      rows,
    };
    this.storedImports.set(storedImport.importId, storedImport);
    return storedImport;
  }

  find(importId: string): StoredLeadImport {
    const storedImport = this.storedImports.get(importId);
    if (!storedImport) throw new Error(`Importação ${importId} não existe no repositório em memória`);
    return storedImport;
  }

  async createLeadImport({ rows, ...leadImportCounts }: CreateLeadImportData): Promise<string> {
    this.createdImports += 1;
    const importId = `importacao-criada-${this.createdImports}`;
    this.add({ importId, ...leadImportCounts, rows, rowsToImport: rows.length });
    return importId;
  }

  async findLeadImportProgress(importId: string, requestedById: string | null): Promise<LeadImportProgress | null> {
    const storedImport = this.storedImports.get(importId);
    if (!storedImport || (requestedById !== null && storedImport.requestedById !== requestedById)) return null;
    return {
      status: storedImport.status,
      totalRows: storedImport.totalRows,
      invalidRows: storedImport.invalidRows,
      duplicateRowsInFile: storedImport.duplicateRowsInFile,
      rowsToImport: storedImport.rowsToImport,
      processedRows: storedImport.processedRows,
      importedLeads: storedImport.importedLeads,
      skippedExistingLeads: storedImport.skippedExistingLeads,
      createdAt: storedImport.createdAt,
      finishedAt: storedImport.finishedAt,
    };
  }

  async hasRunningLeadImport(requestedById: string): Promise<boolean> {
    return [...this.storedImports.values()].some(
      (storedImport) => storedImport.requestedById === requestedById && RUNNING_STATUSES.includes(storedImport.status),
    );
  }

  async startLeadImport(importId: string, startedAt: Date): Promise<LeadImportToProcess | null> {
    const storedImport = this.storedImports.get(importId);
    if (!storedImport || !RUNNING_STATUSES.includes(storedImport.status)) return null;
    storedImport.status = 'PROCESSING';
    storedImport.startedAt ??= startedAt;
    return {
      importId: storedImport.importId,
      requestedById: storedImport.requestedById,
      pipelineId: storedImport.pipelineId,
      stageId: storedImport.stageId,
      rowsToImport: storedImport.rowsToImport,
      processedRows: storedImport.processedRows,
      importedLeads: storedImport.importedLeads,
      skippedExistingLeads: storedImport.skippedExistingLeads,
    };
  }

  async findNextRowsToProcess(importId: string, alreadyProcessedRows: number, chunkSize: number): Promise<LeadImportRowToProcess[]> {
    return this.find(importId).rows.slice(alreadyProcessedRows, alreadyProcessedRows + chunkSize);
  }

  async importChunk({ importId, processedRowsBefore, leadsToCreate }: LeadImportChunk): Promise<number> {
    const storedImport = this.find(importId);
    if (storedImport.status !== 'PROCESSING' || storedImport.processedRows !== processedRowsBefore) {
      throw new LeadImportChunkAlreadyProcessedError(importId);
    }
    this.phonesOfEachReceivedChunk.push(leadsToCreate.map((lead) => lead.phone));
    const newLeads = leadsToCreate.filter((lead) => !this.phonesAlreadyInCrm.has(lead.phone));
    newLeads.forEach((lead) => this.phonesAlreadyInCrm.add(lead.phone));
    storedImport.processedRows += leadsToCreate.length;
    storedImport.importedLeads += newLeads.length;
    storedImport.skippedExistingLeads += leadsToCreate.length - newLeads.length;
    return newLeads.length;
  }

  async completeLeadImport(importId: string, finishedAt: Date): Promise<FinishedLeadImport | null> {
    const storedImport = this.find(importId);
    if (storedImport.status !== 'PROCESSING') return null;
    storedImport.status = 'COMPLETED';
    storedImport.finishedAt = finishedAt;
    storedImport.rows = [];
    return this.describeFinishedImport(storedImport);
  }

  async failLeadImport(importId: string, failureReason: string, finishedAt: Date): Promise<FinishedLeadImport | null> {
    const storedImport = this.find(importId);
    if (!RUNNING_STATUSES.includes(storedImport.status)) return null;
    storedImport.status = 'FAILED';
    storedImport.failureReason = failureReason;
    storedImport.finishedAt = finishedAt;
    return this.describeFinishedImport(storedImport);
  }

  async reopenFailedLeadImport(importId: string): Promise<boolean> {
    const storedImport = this.find(importId);
    if (storedImport.status !== 'FAILED') return false;
    if (storedImport.requestedById !== null && (await this.hasRunningLeadImport(storedImport.requestedById))) {
      throw new ConflictError(LEAD_IMPORT_ERRORS.ALREADY_RUNNING);
    }
    storedImport.status = 'PENDING';
    storedImport.failureReason = null;
    storedImport.startedAt = null;
    storedImport.finishedAt = null;
    storedImport.expiryWarningSentAt = null;
    return true;
  }

  async findStalePendingImportIds(createdBefore: Date): Promise<string[]> {
    return this.findImportIds((storedImport) => storedImport.status === 'PENDING' && storedImport.createdAt < createdBefore);
  }

  async findStaleProcessingImportIds(startedBefore: Date): Promise<string[]> {
    return this.findImportIds(
      (storedImport) => storedImport.status === 'PROCESSING' && storedImport.startedAt !== null && storedImport.startedAt < startedBefore,
    );
  }

  async findFailedImportIdsFinishedBefore(finishedBefore: Date, onlyNotWarned: boolean): Promise<string[]> {
    return this.findImportIds(
      (storedImport) =>
        storedImport.status === 'FAILED' &&
        storedImport.finishedAt !== null &&
        storedImport.finishedAt < finishedBefore &&
        (!onlyNotWarned || storedImport.expiryWarningSentAt === null),
    );
  }

  async expireLeadImport(importId: string): Promise<FinishedLeadImport | null> {
    const storedImport = this.find(importId);
    if (storedImport.status !== 'FAILED') return null;
    storedImport.status = 'EXPIRED';
    storedImport.rows = [];
    return this.describeFinishedImport(storedImport);
  }

  async markExpiryWarningSent(importId: string, sentAt: Date): Promise<FinishedLeadImport | null> {
    const storedImport = this.find(importId);
    if (storedImport.status !== 'FAILED' || storedImport.expiryWarningSentAt !== null) return null;
    storedImport.expiryWarningSentAt = sentAt;
    return this.describeFinishedImport(storedImport);
  }

  private findImportIds(matches: (storedImport: StoredLeadImport) => boolean): string[] {
    return [...this.storedImports.values()].filter(matches).map((storedImport) => storedImport.importId);
  }

  private describeFinishedImport(storedImport: StoredLeadImport): FinishedLeadImport {
    return {
      importId: storedImport.importId,
      requestedById: storedImport.requestedById,
      importedLeads: storedImport.importedLeads,
      skippedExistingLeads: storedImport.skippedExistingLeads,
      finishedAt: storedImport.finishedAt ?? new Date(),
    };
  }
}
