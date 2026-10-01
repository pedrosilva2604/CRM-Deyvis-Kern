import { LeadContactStatus } from '@prisma/client';
import { notDeletedLeads } from '@/models/lead.model';
import type { DatabaseClient } from '@/repositories/database-client';

export interface ILeadIndicatorsRepository {
  countActiveLeads(): Promise<number>;
  countLeadsEnteredSince(firstDayCounted: Date): Promise<number>;
  countUnassignedLeads(): Promise<number>;
  countLeadsWithInvalidOrRejectedContact(): Promise<number>;
  countLeadsWithEmail(): Promise<number>;
}

export class LeadIndicatorsRepository implements ILeadIndicatorsRepository {
  constructor(private readonly prisma: DatabaseClient) {}

  async countActiveLeads(): Promise<number> {
    return await this.prisma.lead.count({ where: notDeletedLeads });
  }

  async countLeadsEnteredSince(firstDayCounted: Date): Promise<number> {
    return await this.prisma.lead.count({ where: { ...notDeletedLeads, enteredOn: { gte: firstDayCounted } } });
  }

  async countUnassignedLeads(): Promise<number> {
    return await this.prisma.lead.count({ where: { ...notDeletedLeads, assignedToId: null } });
  }

  async countLeadsWithInvalidOrRejectedContact(): Promise<number> {
    return await this.prisma.lead.count({
      where: { ...notDeletedLeads, contactStatus: { not: LeadContactStatus.VALID } },
    });
  }

  async countLeadsWithEmail(): Promise<number> {
    return await this.prisma.lead.count({ where: { ...notDeletedLeads, email: { not: null } } });
  }
}
