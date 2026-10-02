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

export interface CreateLeadImportData {
  totalRows: number;
  invalidRows: number;
  duplicateRowsInFile: number;
  pipelineId: string | null;
  stageId: string | null;
  requestedById: string;
  rows: LeadImportRowData[];
}

export interface LeadImportProgress {
  status: LeadImportStatus;
  totalRows: number;
  invalidRows: number;
  duplicateRowsInFile: number;
  rowsToImport: number;
  processedRows: number;
  importedLeads: number;
  skippedExistingLeads: number;
  restoredLeads: number;
  skippedDeletedLeads: number;
  createdAt: Date;
  finishedAt: Date | null;
}

export interface LeadImportToProcess extends LeadImportCounters {
  importId: string;
  requestedById: string | null;
  restoresDeletedLeads: boolean;
  pipelineId: string | null;
  stageId: string | null;
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
  leadsToCreate: LeadImportRowToProcess[];
}

export interface LeadImportChunkResult {
  insertedLeads: number;
  restoredLeads: number;
  skippedDeletedLeads: number;
}

export interface LeadImportCounters {
  rowsToImport: number;
  processedRows: number;
  importedLeads: number;
  skippedExistingLeads: number;
  restoredLeads: number;
  skippedDeletedLeads: number;
}

export interface FinishedLeadImport {
  importId: string;
  requestedById: string | null;
  importedLeads: number;
  skippedExistingLeads: number;
  restoredLeads: number;
  skippedDeletedLeads: number;
  finishedAt: Date;
}

export function toFinishedLeadImport(leadImport: LeadImport, finishedAt: Date): FinishedLeadImport {
  return {
    importId: leadImport.id,
    requestedById: leadImport.requestedById,
    importedLeads: leadImport.importedLeads,
    skippedExistingLeads: leadImport.skippedExistingLeads,
    restoredLeads: leadImport.restoredLeads,
    skippedDeletedLeads: leadImport.skippedDeletedLeads,
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
    importedLeads: leadImport.importedLeads,
    skippedExistingLeads: leadImport.skippedExistingLeads,
    restoredLeads: leadImport.restoredLeads,
    skippedDeletedLeads: leadImport.skippedDeletedLeads,
    createdAt: leadImport.createdAt,
    finishedAt: leadImport.finishedAt,
  };
}

export function toLeadImportToProcess(leadImport: LeadImport, requesterRole: Role | null): LeadImportToProcess {
  return {
    importId: leadImport.id,
    requestedById: leadImport.requestedById,
    restoresDeletedLeads: requesterRole === 'ADMIN',
    pipelineId: leadImport.pipelineId,
    stageId: leadImport.stageId,
    rowsToImport: leadImport.rowsToImport,
    processedRows: leadImport.processedRows,
    importedLeads: leadImport.importedLeads,
    skippedExistingLeads: leadImport.skippedExistingLeads,
    restoredLeads: leadImport.restoredLeads,
    skippedDeletedLeads: leadImport.skippedDeletedLeads,
  };
}
