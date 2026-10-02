import { randomUUID } from 'node:crypto';
import type { LeadImportStatus, Role } from '@prisma/client';
import { inject } from 'vitest';
import { createDatabaseClient, type DatabaseClient } from '@/repositories/database-client';

export interface TestFunnel {
  pipelineId: string;
  stageId: string;
  ownerId: string;
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
  intoTestFunnel?: boolean;
}

export interface TestPipeline {
  pipelineId: string;
  stageIdByName: Record<string, string>;
}

export interface StageMarks {
  wonStage?: string;
  lostStage?: string;
}

export interface UserToAdd {
  role?: Role;
  active?: boolean;
}

export const ORIGINAL_PASSWORD_HASH = 'hash-da-senha-original';
const ENTERED_ON = new Date('2026-09-30T00:00:00.000Z');
const ONE_HOUR_MS = 60 * 60 * 1000;

function oneHourFromNow(): Date {
  return new Date(Date.now() + ONE_HOUR_MS);
}

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
    const owner = await this.addUser('Dono do funil de teste');
    const pipeline = await this.client.pipeline.create({
      data: { name: 'Funil de teste', ownerId: owner, stages: { create: { name: 'Novo' } } },
      include: { stages: true },
    });
    this.currentFunnel = { pipelineId: pipeline.id, stageId: pipeline.stages[0]!.id, ownerId: owner };
  }

  async addUser(name: string, { role = 'AGENT', active = true }: UserToAdd = {}): Promise<string> {
    const user = await this.client.user.create({
      data: { name, role, active, email: `${randomUUID()}@teste.local`, passwordHash: ORIGINAL_PASSWORD_HASH },
      select: { id: true },
    });
    return user.id;
  }

  async addOpenSession(userId: string): Promise<void> {
    await this.client.session.create({ data: { userId, expiresAt: oneHourFromNow() } });
  }

  async addResetToken(userId: string): Promise<string> {
    const resetToken = await this.client.passwordResetToken.create({
      data: { userId, tokenHash: randomUUID(), expiresAt: oneHourFromNow() },
      select: { id: true },
    });
    return resetToken.id;
  }

  async findUser(userId: string) {
    return await this.client.user.findUniqueOrThrow({ where: { id: userId } });
  }

  async countOpenSessionsOf(userId: string): Promise<number> {
    return await this.client.session.count({ where: { userId, revokedAt: null } });
  }

  async isResetTokenStillUsable(resetTokenId: string): Promise<boolean> {
    const resetToken = await this.client.passwordResetToken.findUniqueOrThrow({ where: { id: resetTokenId } });
    return resetToken.usedAt === null;
  }

  async countActiveAdmins(): Promise<number> {
    return await this.client.user.count({ where: { role: 'ADMIN', active: true } });
  }

  async addLead({ name, phone, email, deleted = false }: LeadToAdd): Promise<string> {
    const lead = await this.client.lead.create({
      data: {
        name,
        phone,
        email: email ?? null,
        enteredOn: ENTERED_ON,
        deletedAt: deleted ? new Date() : null,
      },
      select: { id: true },
    });
    return lead.id;
  }

  async addLeadImport({ requestedById, status, phonesToImport = [], processedRows = 0, intoTestFunnel = false }: LeadImportToAdd): Promise<string> {
    const leadImport = await this.client.leadImport.create({
      data: {
        status,
        requestedById,
        totalRows: phonesToImport.length,
        invalidRows: 0,
        duplicateRowsInFile: 0,
        rowsToImport: phonesToImport.length,
        processedRows,
        ...(intoTestFunnel && { pipelineId: this.funnel.pipelineId, stageId: this.funnel.stageId }),
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

  async addPipeline(ownerId: string, stageNames: string[], { wonStage, lostStage }: StageMarks = {}): Promise<TestPipeline> {
    const pipeline = await this.client.pipeline.create({
      data: {
        name: `Funil ${randomUUID().slice(0, 8)}`,
        ownerId,
        stages: {
          create: stageNames.map((name, position) => ({ name, position, isWon: name === wonStage, isLost: name === lostStage })),
        },
      },
      include: { stages: { orderBy: { position: 'asc' } } },
    });
    return {
      pipelineId: pipeline.id,
      stageIdByName: Object.fromEntries(pipeline.stages.map((stage) => [stage.name, stage.id])),
    };
  }

  async addMember(pipelineId: string, userId: string): Promise<void> {
    await this.client.pipelineMember.create({ data: { pipelineId, userId } });
  }

  async addCard(pipelineId: string, stageId: string, leadId: string, position: number): Promise<string> {
    const card = await this.client.pipelineCard.create({ data: { pipelineId, stageId, leadId, position }, select: { id: true } });
    return card.id;
  }

  async findLeadNamesInStageOrder(stageId: string): Promise<string[]> {
    const cards = await this.client.pipelineCard.findMany({
      where: { stageId },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      select: { lead: { select: { name: true } } },
    });
    return cards.map(({ lead }) => lead.name);
  }

  async findCard(cardId: string) {
    return await this.client.pipelineCard.findUniqueOrThrow({ where: { id: cardId } });
  }

  async findPipelinesOwnedBy(ownerId: string) {
    return await this.client.pipeline.findMany({ where: { ownerId }, include: { stages: { orderBy: { position: 'asc' } } } });
  }

  async findLeadImport(importId: string) {
    return await this.client.leadImport.findUniqueOrThrow({ where: { id: importId } });
  }

  async countStoredRowsOf(importId: string): Promise<number> {
    return await this.client.leadImportRow.count({ where: { leadImportId: importId } });
  }

  async findLeadByPhone(phone: string) {
    return await this.client.lead.findUniqueOrThrow({ where: { phone } });
  }

  async findPhonesOfAllLeads(): Promise<string[]> {
    const leads = await this.client.lead.findMany({ select: { phone: true }, orderBy: { phone: 'asc' } });
    return leads.map(({ phone }) => phone);
  }

  async disconnect(): Promise<void> {
    await this.client.$disconnect();
  }
}

export function leadsToCreateFrom(phones: string[]) {
  return phones.map((phone) => ({
    name: `Lead ${phone}`,
    phone,
    phoneCountry: 'BR',
    email: null,
    enteredOn: ENTERED_ON,
  }));
}
