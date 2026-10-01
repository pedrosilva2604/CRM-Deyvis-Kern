import type { ILeadImportQueue, LeadImportJobState } from '@/queues/lead-import.queue';

export class InMemoryLeadImportQueue implements ILeadImportQueue {
  readonly enqueuedImportIds: string[] = [];
  readonly requeuedImportIds: string[] = [];
  private readonly jobStateByImportId = new Map<string, LeadImportJobState>();

  setJobState(importId: string, jobState: LeadImportJobState): void {
    this.jobStateByImportId.set(importId, jobState);
  }

  async enqueueLeadImport(importId: string): Promise<void> {
    this.enqueuedImportIds.push(importId);
    this.jobStateByImportId.set(importId, 'scheduled');
  }

  async findLeadImportJobState(importId: string): Promise<LeadImportJobState> {
    return this.jobStateByImportId.get(importId) ?? 'missing';
  }

  async requeueLeadImport(importId: string): Promise<void> {
    this.requeuedImportIds.push(importId);
    this.jobStateByImportId.set(importId, 'scheduled');
  }

  async close(): Promise<void> {}
}
