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
  pipelineId: string;
  stageId: string;
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
  createdAt: Date;
  finishedAt: Date | null;
}

export interface LeadImportToProcess {
  importId: string;
  requestedById: string | null;
  pipelineId: string;
  stageId: string;
  rowsToImport: number;
  processedRows: number;
  importedLeads: number;
  skippedExistingLeads: number;
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
  leadsToCreate: Array<LeadImportRowToProcess & { pipelineId: string; stageId: string }>;
}

export interface LeadImportCounters {
  rowsToImport: number;
  processedRows: number;
  importedLeads: number;
  skippedExistingLeads: number;
}

export interface FinishedLeadImport {
  importId: string;
  requestedById: string | null;
  importedLeads: number;
  skippedExistingLeads: number;
  finishedAt: Date;
}

export function toFinishedLeadImport(leadImport: LeadImport, finishedAt: Date): FinishedLeadImport {
  return {
    importId: leadImport.id,
    requestedById: leadImport.requestedById,
    importedLeads: leadImport.importedLeads,
    skippedExistingLeads: leadImport.skippedExistingLeads,
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
    createdAt: leadImport.createdAt,
    finishedAt: leadImport.finishedAt,
  };
}

export function toLeadImportToProcess(leadImport: LeadImport): LeadImportToProcess {
  return {
    importId: leadImport.id,
    requestedById: leadImport.requestedById,
    pipelineId: leadImport.pipelineId,
    stageId: leadImport.stageId,
    rowsToImport: leadImport.rowsToImport,
    processedRows: leadImport.processedRows,
    importedLeads: leadImport.importedLeads,
    skippedExistingLeads: leadImport.skippedExistingLeads,
  };
}
