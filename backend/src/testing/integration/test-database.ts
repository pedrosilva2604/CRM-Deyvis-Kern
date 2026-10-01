import { randomUUID } from 'node:crypto';
import type { LeadImportStatus } from '@prisma/client';
import { inject } from 'vitest';
import { createDatabaseClient, type DatabaseClient } from '@/repositories/database-client';

export interface TestFunnel {
  pipelineId: string;
  stageId: string;
}

export interface LeadToAdd {
  name: string;
  phone: string;
  email?: string;
  deleted?: boolean;
}

export interface LeadImportToAdd {
  requestedById: string;
  status: LeadImportStatus;
  phonesToImport?: string[];
  processedRows?: number;
}

const ENTERED_ON = new Date('2026-09-30T00:00:00.000Z');

export class TestDatabase {
  readonly client: DatabaseClient = createDatabaseClient(inject('testDatabaseUrl'));
  private currentFunnel: TestFunnel | null = null;

  get funnel(): TestFunnel {
    if (!this.currentFunnel) throw new Error('Chame prepareEmptyDatabase() antes de usar o funil');
    return this.currentFunnel;
  }

  async prepareEmptyDatabase(): Promise<void> {
    await this.client.$transaction([
      this.client.lead.deleteMany(),
      this.client.leadImport.deleteMany(),
      this.client.notification.deleteMany(),
      this.client.pipeline.deleteMany(),
      this.client.user.deleteMany(),
    ]);
    const pipeline = await this.client.pipeline.create({
      data: { name: 'Funil de teste', stages: { create: { name: 'Novo' } } },
      include: { stages: true },
    });
    this.currentFunnel = { pipelineId: pipeline.id, stageId: pipeline.stages[0]!.id };
  }

  async addUser(name: string): Promise<string> {
    const user = await this.client.user.create({
      data: { name, email: `${randomUUID()}@teste.local`, passwordHash: 'sem-senha-nos-testes' },
      select: { id: true },
    });
    return user.id;
  }

  async addLead({ name, phone, email, deleted = false }: LeadToAdd): Promise<string> {
    const lead = await this.client.lead.create({
      data: {
        name,
        phone,
        email: email ?? null,
        enteredOn: ENTERED_ON,
        deletedAt: deleted ? new Date() : null,
        ...this.funnel,
      },
      select: { id: true },
    });
    return lead.id;
  }

  async addLeadImport({ requestedById, status, phonesToImport = [], processedRows = 0 }: LeadImportToAdd): Promise<string> {
    const leadImport = await this.client.leadImport.create({
      data: {
        status,
        requestedById,
        totalRows: phonesToImport.length,
        invalidRows: 0,
        duplicateRowsInFile: 0,
        rowsToImport: phonesToImport.length,
        processedRows,
        ...this.funnel,
        rows: {
          createMany: {
            data: phonesToImport.map((phone, rowIndex) => ({
              rowNumber: rowIndex + 1,
              name: `Lead ${phone}`,
              phone,
              enteredOn: ENTERED_ON,
            })),
          },
        },
      },
      select: { id: true },
    });
    return leadImport.id;
  }

  async findLeadImport(importId: string) {
    return await this.client.leadImport.findUniqueOrThrow({ where: { id: importId } });
  }

  async countStoredRowsOf(importId: string): Promise<number> {
    return await this.client.leadImportRow.count({ where: { leadImportId: importId } });
  }

  async findPhonesOfAllLeads(): Promise<string[]> {
    const leads = await this.client.lead.findMany({ select: { phone: true }, orderBy: { phone: 'asc' } });
    return leads.map(({ phone }) => phone);
  }

  async disconnect(): Promise<void> {
    await this.client.$disconnect();
  }
}

export function leadsToCreateFrom(phones: string[], funnel: TestFunnel) {
  return phones.map((phone) => ({
    name: `Lead ${phone}`,
    phone,
    phoneCountry: 'BR',
    email: null,
    enteredOn: ENTERED_ON,
    ...funnel,
  }));
}
