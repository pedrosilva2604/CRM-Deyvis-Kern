import type { ILeadIndicatorsRepository } from '@/repositories/lead-indicators.repository';

export interface StoredLeadForIndicators {
  enteredOn: Date;
  hasAssignee: boolean;
  contactStatus: 'VALID' | 'INVALID' | 'SPAM';
  hasEmail: boolean;
}

export class InMemoryLeadIndicatorsRepository implements ILeadIndicatorsRepository {
  private readonly storedLeads: StoredLeadForIndicators[] = [];

  add(quantity: number, lead: Partial<StoredLeadForIndicators> = {}): void {
    for (let leadNumber = 0; leadNumber < quantity; leadNumber += 1) {
      this.storedLeads.push({
        enteredOn: new Date('2026-01-01T00:00:00.000Z'),
        hasAssignee: true,
        contactStatus: 'VALID',
        hasEmail: true,
        ...lead,
      });
    }
  }

  async countActiveLeads(): Promise<number> {
    return this.storedLeads.length;
  }

  async countLeadsEnteredSince(firstDayCounted: Date): Promise<number> {
    return this.storedLeads.filter((lead) => lead.enteredOn >= firstDayCounted).length;
  }

  async countUnassignedLeads(): Promise<number> {
    return this.storedLeads.filter((lead) => !lead.hasAssignee).length;
  }

  async countLeadsWithInvalidOrRejectedContact(): Promise<number> {
    return this.storedLeads.filter((lead) => lead.contactStatus !== 'VALID').length;
  }

  async countLeadsWithEmail(): Promise<number> {
    return this.storedLeads.filter((lead) => lead.hasEmail).length;
  }
}
