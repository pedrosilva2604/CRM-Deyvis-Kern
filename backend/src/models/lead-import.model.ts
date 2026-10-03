import type { LeadImport, LeadImportStatus } from '@prisma/client';

export type LeadImportIdParams = {
  importId: string;
};

export interface LeadImportProgressRequest {
  targetImportId: string;
}

export interface LeadImportRetryRequest {
  targetImportId: string;
}

export interface LeadImportIntoPipelineRequest {
  targetPipelineId: string;
  targetStageId: string;
  csvText: string;
}

export interface LeadImportReceipt {
  importId: string;
}

export interface LeadImportRowData {
  rowNumber: number;
  name: string;
  phone: string;
  phoneCountry: string | null;
  email: string | null;
  enteredOn: Date;
}

export interface LeadImportDestination {
  pipelineId: string;
  stageId: string;
}

export interface CreateLeadImportData {
  totalRows: number;
  invalidRows: number;
  duplicateRowsInFile: number;
  pipelineId: string | null;
  stageId: string | null;
  requestedById: string;
  rows: LeadImportRowData[];
}

export interface LeadImportOutcomeCounts {
  importedLeads: number;
  skippedExistingLeads: number;
  addedToPipelineLeads: number;
  alreadyInPipelineLeads: number;
}

export interface LeadImportCounters extends LeadImportOutcomeCounts {
  rowsToImport: number;
  processedRows: number;
}

export interface LeadImportProgress extends LeadImportCounters {
  status: LeadImportStatus;
  totalRows: number;
  invalidRows: number;
  duplicateRowsInFile: number;
  importsIntoPipeline: boolean;
  createdAt: Date;
  finishedAt: Date | null;
}

export interface LeadImportToProcess extends LeadImportCounters {
  importId: string;
  requestedById: string;
  destination: LeadImportDestination | null;
}

export interface LeadImportRowToProcess {
  name: string;
  phone: string;
  phoneCountry: string | null;
  email: string | null;
  enteredOn: Date;
}

export interface LeadImportChunk {
  importId: string;
  processedRowsBefore: number;
  destination: LeadImportDestination | null;
  addedById: string;
  leadsToCreate: LeadImportRowToProcess[];
}

export interface LeadImportChunkResult {
  insertedLeads: number;
  addedToPipelineLeads: number;
  alreadyInPipelineLeads: number;
}

export interface FinishedLeadImport extends LeadImportOutcomeCounts {
  importId: string;
  requestedById: string;
  destination: LeadImportDestination | null;
  finishedAt: Date;
}

function readOutcomeCounts(leadImport: LeadImport): LeadImportOutcomeCounts {
  return {
    importedLeads: leadImport.importedLeads,
    skippedExistingLeads: leadImport.skippedExistingLeads,
    addedToPipelineLeads: leadImport.addedToPipelineLeads,
    alreadyInPipelineLeads: leadImport.alreadyInPipelineLeads,
  };
}

function readDestination(leadImport: LeadImport): LeadImportDestination | null {
  if (leadImport.pipelineId === null || leadImport.stageId === null) return null;
  return { pipelineId: leadImport.pipelineId, stageId: leadImport.stageId };
}

export function toFinishedLeadImport(leadImport: LeadImport, finishedAt: Date): FinishedLeadImport {
  return {
    importId: leadImport.id,
    requestedById: leadImport.requestedById,
    destination: readDestination(leadImport),
    ...readOutcomeCounts(leadImport),
    finishedAt: leadImport.finishedAt ?? finishedAt,
  };
}

export function toLeadImportProgress(leadImport: LeadImport): LeadImportProgress {
  return {
    status: leadImport.status,
    totalRows: leadImport.totalRows,
    invalidRows: leadImport.invalidRows,
    duplicateRowsInFile: leadImport.duplicateRowsInFile,
    rowsToImport: leadImport.rowsToImport,
    processedRows: leadImport.processedRows,
    ...readOutcomeCounts(leadImport),
    importsIntoPipeline: readDestination(leadImport) !== null,
    createdAt: leadImport.createdAt,
    finishedAt: leadImport.finishedAt,
  };
}

export function toLeadImportToProcess(leadImport: LeadImport): LeadImportToProcess {
  return {
    importId: leadImport.id,
    requestedById: leadImport.requestedById,
    destination: readDestination(leadImport),
    rowsToImport: leadImport.rowsToImport,
    processedRows: leadImport.processedRows,
    ...readOutcomeCounts(leadImport),
  };
}
