import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, DatabaseUnavailableError, NotFoundError } from '@/errors/app-errors';
import { LEAD_ERRORS, REQUEST_ERRORS } from '@/errors/errors.constants';
import type { CreateLeadData } from '@/models/lead.model';
import { TestDatabase } from '@/testing/integration/test-database';
import { createDatabaseClient } from './database-client';
import { LeadRepository } from './lead.repository';

const database = new TestDatabase();
const leads = new LeadRepository(database.client);
const DATABASE_THAT_IS_OFF = 'postgresql://ninguem:sem-senha@127.0.0.1:1/banco_desligado_test';

function newLead(lead: Pick<CreateLeadData, 'name' | 'phone' | 'email'>): CreateLeadData {
  return {
    ...lead,
    phoneCountry: 'BR',
    source: null,
    tags: [],
    value: null,
    enteredOn: new Date('2026-09-30T00:00:00.000Z'),
    assignedToId: null,
  };
}

beforeEach(async () => {
  await database.prepareEmptyDatabase();
});

afterAll(async () => {
  await database.disconnect();
});

describe('Erros do banco traduzidos para o usuário', () => {
  it('telefone repetido vira conflito (409) dizendo que o telefone já está em uso', async () => {
    await database.addLead({ name: 'Maria Souza', phone: '+5511900000001' });

    const repeatedPhone = leads.createLead(newLead({ name: 'Outra Maria', phone: '+5511900000001', email: null }));

    await expect(repeatedPhone).rejects.toBeInstanceOf(ConflictError);
    await expect(repeatedPhone).rejects.toThrow(LEAD_ERRORS.PHONE_IN_USE);
  });

  it('e-mail repetido vira conflito (409) dizendo que o e-mail já está em uso', async () => {
    await database.addLead({ name: 'Maria Souza', phone: '+5511900000001', email: 'maria@empresa.com' });

    const repeatedEmail = leads.createLead(newLead({ name: 'Outra Maria', phone: '+5511900000002', email: 'maria@empresa.com' }));

    await expect(repeatedEmail).rejects.toBeInstanceOf(ConflictError);
    await expect(repeatedEmail).rejects.toThrow(LEAD_ERRORS.EMAIL_IN_USE);
  });

  it('alterar um lead que não existe vira "não encontrado" (404)', async () => {
    const leadThatDoesNotExist = randomUUID();

    const update = database.client.lead.update({ where: { id: leadThatDoesNotExist }, data: { name: 'Novo nome' } });

    await expect(update).rejects.toBeInstanceOf(NotFoundError);
    await expect(update).rejects.toThrow(LEAD_ERRORS.NOT_FOUND);
  });

  it('apontar para algo que acabou de ser excluído vira conflito (409), e não erro 500', async () => {
    const lead = await database.addLead({ name: 'Maria', phone: '+5511900000001' });

    const cardInDeletedStage = database.client.pipelineCard.create({
      data: { pipelineId: database.funnel.pipelineId, stageId: randomUUID(), leadId: lead, addedById: database.funnel.ownerId, position: 1024 },
    });

    await expect(cardInDeletedStage).rejects.toBeInstanceOf(ConflictError);
    await expect(cardInDeletedStage).rejects.toThrow(REQUEST_ERRORS.RESOURCE_CHANGED_MEANWHILE);
  });

  it('banco fora do ar vira "serviço indisponível" (503), sem mostrar o erro técnico', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const clientOfDatabaseThatIsOff = createDatabaseClient(DATABASE_THAT_IS_OFF);

    const search = new LeadRepository(clientOfDatabaseThatIsOff).findLeadById(randomUUID());

    await expect(search).rejects.toBeInstanceOf(DatabaseUnavailableError);
    await expect(search).rejects.toThrow(REQUEST_ERRORS.SERVICE_UNAVAILABLE);
    await clientOfDatabaseThatIsOff.$disconnect();
    vi.restoreAllMocks();
  });
});
