import type { LeadImport, LeadImportStatus, Role } from '@prisma/client';

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
  restoredLeads: number;
  skippedDeletedLeads: number;
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
  requestedById: string | null;
  restoresDeletedLeads: boolean;
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
  restoresDeletedLeads: boolean;
  destination: LeadImportDestination | null;
  addedById: string | null;
  leadsToCreate: LeadImportRowToProcess[];
}

export interface LeadImportChunkResult {
  insertedLeads: number;
  restoredLeads: number;
  skippedDeletedLeads: number;
  addedToPipelineLeads: number;
  alreadyInPipelineLeads: number;
}

export interface FinishedLeadImport extends LeadImportOutcomeCounts {
  importId: string;
  requestedById: string | null;
  destination: LeadImportDestination | null;
  finishedAt: Date;
}

function readOutcomeCounts(leadImport: LeadImport): LeadImportOutcomeCounts {
  return {
    importedLeads: leadImport.importedLeads,
    skippedExistingLeads: leadImport.skippedExistingLeads,
    restoredLeads: leadImport.restoredLeads,
    skippedDeletedLeads: leadImport.skippedDeletedLeads,
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

export function toLeadImportToProcess(leadImport: LeadImport, requesterRole: Role | null): LeadImportToProcess {
  return {
    importId: leadImport.id,
    requestedById: leadImport.requestedById,
    restoresDeletedLeads: requesterRole === 'ADMIN',
    destination: readDestination(leadImport),
    rowsToImport: leadImport.rowsToImport,
    processedRows: leadImport.processedRows,
    ...readOutcomeCounts(leadImport),
  };
}
