import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ConflictError } from '@/errors/app-errors';
import { LEAD_IMPORT_ERRORS } from '@/errors/errors.constants';
import type { LeadImportChunk } from '@/models/lead-import.model';
import { leadsToCreateFrom, TestDatabase } from '@/testing/integration/test-database';
import { LeadImportChunkAlreadyProcessedError, LeadImportRepository } from './lead-import.repository';
import { LeadRepository } from './lead.repository';

const database = new TestDatabase();
const leadImports = new LeadImportRepository(database.client);
const leads = new LeadRepository(database.client);
const finishedAt = new Date('2026-09-30T12:00:00.000Z');

function newImportRequestedBy(requestedById: string) {
  return {
    totalRows: 1,
    invalidRows: 0,
    duplicateRowsInFile: 0,
    requestedById,
    pipelineId: null,
    stageId: null,
    rows: [{ rowNumber: 1, name: 'Lead', phone: '+5511900000001', phoneCountry: 'BR', email: null, enteredOn: finishedAt }],
  };
}

const DISPUTES_TO_CATCH_A_DEADLOCK = 15;

function chunkOf(importId: string, phones: string[]): LeadImportChunk {
  return {
    importId,
    processedRowsBefore: 0,
    destination: null,
    addedById: database.funnel.ownerId,
    leadsToCreate: leadsToCreateFrom(phones),
  };
}

beforeEach(async () => {
  await database.prepareEmptyDatabase();
});

afterAll(async () => {
  await database.disconnect();
});

describe('Gravação de um pedaço da importação', () => {
  it('grava os leads e avança o contador da importação juntos', async () => {
    const maria = await database.addUser('Maria');
    const importId = await database.addLeadImport({ requestedById: maria, status: 'PROCESSING' });

    await leadImports.importChunk(chunkOf(importId, ['+5511900000001', '+5511900000002']));

    expect(await database.findPhonesOfAllLeads()).toEqual(['+5511900000001', '+5511900000002']);
    expect(await database.findLeadImport(importId)).toMatchObject({ processedRows: 2, importedLeads: 2 });
  });

  it('não duplica o lead cujo telefone já está no CRM e conta como "já existia"', async () => {
    const maria = await database.addUser('Maria');
    await database.addLead({ name: 'Cliente antigo', phone: '+5511900000001' });
    const importId = await database.addLeadImport({ requestedById: maria, status: 'PROCESSING' });

    const chunkResult = await leadImports.importChunk(chunkOf(importId, ['+5511900000001', '+5511900000002']));

    expect(chunkResult).toMatchObject({ insertedLeads: 1 });
    expect(await database.findPhonesOfAllLeads()).toEqual(['+5511900000001', '+5511900000002']);
    expect(await database.findLeadImport(importId)).toMatchObject({ importedLeads: 1, skippedExistingLeads: 1 });
  });

  it('recusa o pedaço que outra execução já gravou e desfaz os leads que tentou inserir', async () => {
    const maria = await database.addUser('Maria');
    const importId = await database.addLeadImport({ requestedById: maria, status: 'PROCESSING' });
    await leadImports.importChunk(chunkOf(importId, ['+5511900000001']));

    const secondExecution = leadImports.importChunk(chunkOf(importId, ['+5511900000099']));

    await expect(secondExecution).rejects.toBeInstanceOf(LeadImportChunkAlreadyProcessedError);
    expect(await database.findPhonesOfAllLeads()).toEqual(['+5511900000001']);
    expect(await database.findLeadImport(importId)).toMatchObject({ processedRows: 1, importedLeads: 1 });
  });
});

describe('Registrar a importação', () => {
  it('não registra a importação para uma etapa que acabou de ser excluída', async () => {
    const maria = await database.addUser('Maria');
    const funnel = await database.addPipeline(maria, ['Novo lead']);
    const stageId = funnel.stageIdByName['Novo lead']!;
    await database.client.pipeline.delete({ where: { id: funnel.pipelineId } });

    const importId = await leadImports.createLeadImport({ ...newImportRequestedBy(maria), pipelineId: funnel.pipelineId, stageId });

    expect(importId).toBeNull();
  });

  it('a importação retomada volta para a fila agora, e não parece parada há tempo', async () => {
    const maria = await database.addUser('Maria');
    const importId = await database.addLeadImport({ requestedById: maria, status: 'FAILED' });
    await database.client.leadImport.update({ where: { id: importId }, data: { createdAt: new Date('2026-09-01'), queuedAt: new Date('2026-09-01') } });

    await leadImports.reopenFailedLeadImport(importId);

    expect(await leadImports.findStalePendingImportIds(new Date(Date.now() - 60_000))).not.toContain(importId);
  });
});

describe('Lead excluído na importação', () => {
  it('o telefone e o e-mail de um lead excluído voltam como um lead novo, sem nada do antigo', async () => {
    const maria = await database.addUser('Maria');
    const joao = await database.addLead({ name: 'João', phone: '+5511900000001', email: 'joao@empresa.com' });
    await leads.eraseLead({ leadId: joao, deletedAt: new Date(), deletedById: maria });
    const importId = await database.addLeadImport({ requestedById: maria, status: 'PROCESSING' });

    const chunkResult = await leadImports.importChunk(chunkOf(importId, ['+5511900000001']));

    const leadOfRow = await database.findLeadByPhone('+5511900000001');
    expect(chunkResult).toMatchObject({ insertedLeads: 1 });
    expect(leadOfRow.id).not.toBe(joao);
    expect(await database.findLead(joao)).toMatchObject({ name: 'Lead excluído', phone: null });
  });
});
describe('Importação direto numa etapa do funil', () => {
  it('cria os novos na base, põe no funil quem não estava e deixa onde está quem já estava', async () => {
    const maria = await database.addUser('Maria');
    const funnel = await database.addPipeline(maria, ['Novo lead', 'Proposta']);
    const newStage = funnel.stageIdByName['Novo lead']!;
    const proposalStage = funnel.stageIdByName['Proposta']!;
    await database.addLead({ name: 'Cliente antigo fora do funil', phone: '+5511900000001' });
    const alreadyInFunnel = await database.addLead({ name: 'Cliente já na proposta', phone: '+5511900000002' });
    await database.addCard(funnel.pipelineId, proposalStage, alreadyInFunnel, 1024);
    const importId = await database.addLeadImport({ requestedById: maria, status: 'PROCESSING' });

    const chunkResult = await leadImports.importChunk({
      ...chunkOf(importId, ['+5511900000001', '+5511900000002', '+5511900000003']),
      destination: { pipelineId: funnel.pipelineId, stageId: newStage },
      addedById: maria,
    });

    expect(chunkResult).toMatchObject({ insertedLeads: 1, addedToPipelineLeads: 2, alreadyInPipelineLeads: 1 });
    expect((await database.findLeadNamesInStageOrder(newStage)).sort()).toEqual(['Cliente antigo fora do funil', 'Lead +5511900000003']);
    expect(await database.findLeadNamesInStageOrder(proposalStage)).toEqual(['Cliente já na proposta']);
    expect(await database.findLeadImport(importId)).toMatchObject({ addedToPipelineLeads: 2, alreadyInPipelineLeads: 1 });
  });

  it('se a etapa virou Ganho no meio da importação, os leads ficam só na base, sem falhar', async () => {
    const maria = await database.addUser('Maria');
    const funnel = await database.addPipeline(maria, ['Proposta']);
    const proposalStage = funnel.stageIdByName['Proposta']!;
    const importId = await database.addLeadImport({ requestedById: maria, status: 'PROCESSING' });
    await database.client.stage.update({ where: { id: proposalStage }, data: { isWon: true } });

    const chunkResult = await leadImports.importChunk({
      ...chunkOf(importId, ['+5511900000001']),
      destination: { pipelineId: funnel.pipelineId, stageId: proposalStage },
      addedById: maria,
    });

    expect(chunkResult).toMatchObject({ insertedLeads: 1, addedToPipelineLeads: 0 });
    expect(await database.findLeadNamesInStageOrder(proposalStage)).toEqual([]);
  });

  it('se o funil foi excluído no meio da importação, os leads ficam só na base, sem falhar', async () => {
    const maria = await database.addUser('Maria');
    const funnel = await database.addPipeline(maria, ['Novo lead']);
    const destinationBeforeDeletion = { pipelineId: funnel.pipelineId, stageId: funnel.stageIdByName['Novo lead']! };
    const importId = await database.addLeadImport({ requestedById: maria, status: 'PROCESSING' });
    await database.client.pipeline.delete({ where: { id: funnel.pipelineId } });

    const chunkResult = await leadImports.importChunk({
      ...chunkOf(importId, ['+5511900000001', '+5511900000002']),
      destination: destinationBeforeDeletion,
      addedById: maria,
    });

    expect(chunkResult).toMatchObject({ insertedLeads: 2, addedToPipelineLeads: 0, alreadyInPipelineLeads: 0 });
    expect(await database.findLeadImport(importId)).toMatchObject({ processedRows: 2, importedLeads: 2 });
  });
});

describe('Duas importações gravando os mesmos telefones ao mesmo tempo', () => {
  it('terminam as duas, sem deadlock e sem lead duplicado (em 15 disputas)', async () => {
    const phones = Array.from({ length: 40 }, (_, phoneIndex) => `+55119000${String(phoneIndex).padStart(5, '0')}`);
    const failures: string[] = [];

    for (let dispute = 1; dispute <= DISPUTES_TO_CATCH_A_DEADLOCK; dispute += 1) {
      await database.prepareEmptyDatabase();
      const ana = await database.addUser('Ana', { role: 'ADMIN' });
      const maria = await database.addUser('Maria');
      const importOfAna = await database.addLeadImport({ requestedById: ana, status: 'PROCESSING' });
      const importOfMaria = await database.addLeadImport({ requestedById: maria, status: 'PROCESSING' });

      const outcomes = await Promise.allSettled([
        leadImports.importChunk(chunkOf(importOfAna, phones)),
        leadImports.importChunk(chunkOf(importOfMaria, phones)),
      ]);

      outcomes.forEach((outcome) => outcome.status === 'rejected' && failures.push(String(outcome.reason).split('\n')[0]!));
      expect(await database.findPhonesOfAllLeads()).toHaveLength(phones.length);
    }

    expect(failures).toEqual([]);
  });
});
describe('Uma importação em andamento por usuário', () => {
  it('aceita só uma de duas importações enviadas ao mesmo tempo pelo mesmo usuário', async () => {
    const maria = await database.addUser('Maria');

    const [firstSending, secondSending] = await Promise.allSettled([
      leadImports.createLeadImport(newImportRequestedBy(maria)),
      leadImports.createLeadImport(newImportRequestedBy(maria)),
    ]);
    const sendings = [firstSending, secondSending];

    expect(sendings.filter((sending) => sending.status === 'fulfilled')).toHaveLength(1);
    const refusedSending = sendings.find((sending) => sending.status === 'rejected');
    expect(refusedSending?.reason).toBeInstanceOf(ConflictError);
    expect(refusedSending?.reason.message).toBe(LEAD_IMPORT_ERRORS.ALREADY_RUNNING);
  });

  it('deixa usuários diferentes importarem ao mesmo tempo', async () => {
    const maria = await database.addUser('Maria');
    const joao = await database.addUser('João');

    const sendings = await Promise.allSettled([
      leadImports.createLeadImport(newImportRequestedBy(maria)),
      leadImports.createLeadImport(newImportRequestedBy(joao)),
    ]);

    expect(sendings.map((sending) => sending.status)).toEqual(['fulfilled', 'fulfilled']);
  });

  it('libera uma nova importação depois que a anterior terminou', async () => {
    const maria = await database.addUser('Maria');
    await database.addLeadImport({ requestedById: maria, status: 'COMPLETED' });
    await database.addLeadImport({ requestedById: maria, status: 'FAILED' });

    await expect(leadImports.createLeadImport(newImportRequestedBy(maria))).resolves.toEqual(expect.any(String));
  });
});

describe('Retomar uma importação interrompida', () => {
  it('volta para PENDING mantendo o progresso e as linhas guardadas', async () => {
    const maria = await database.addUser('Maria');
    const importId = await database.addLeadImport({
      requestedById: maria,
      status: 'FAILED',
      phonesToImport: ['+5511900000001', '+5511900000002'],
      processedRows: 1,
    });

    expect(await leadImports.reopenFailedLeadImport(importId)).toBe(true);

    expect(await database.findLeadImport(importId)).toMatchObject({ status: 'PENDING', processedRows: 1, finishedAt: null });
    expect(await database.countStoredRowsOf(importId)).toBe(2);
  });

  it('não reabre uma importação que não falhou', async () => {
    const maria = await database.addUser('Maria');
    const importId = await database.addLeadImport({ requestedById: maria, status: 'COMPLETED' });

    expect(await leadImports.reopenFailedLeadImport(importId)).toBe(false);
    expect(await database.findLeadImport(importId)).toMatchObject({ status: 'COMPLETED' });
  });

  it('o banco recusa se a pessoa já tem outra importação em andamento', async () => {
    const maria = await database.addUser('Maria');
    const failedImport = await database.addLeadImport({ requestedById: maria, status: 'FAILED' });
    await database.addLeadImport({ requestedById: maria, status: 'PROCESSING' });

    const reopening = leadImports.reopenFailedLeadImport(failedImport);

    await expect(reopening).rejects.toBeInstanceOf(ConflictError);
    await expect(reopening).rejects.toThrow(LEAD_IMPORT_ERRORS.ALREADY_RUNNING);
    expect(await database.findLeadImport(failedImport)).toMatchObject({ status: 'FAILED' });
  });
});

describe('Linhas guardadas da planilha', () => {
  it('são apagadas quando a importação é concluída', async () => {
    const maria = await database.addUser('Maria');
    const importId = await database.addLeadImport({
      requestedById: maria,
      status: 'PROCESSING',
      phonesToImport: ['+5511900000001', '+5511900000002'],
    });

    await leadImports.completeLeadImport(importId, finishedAt);

    expect(await database.findLeadImport(importId)).toMatchObject({ status: 'COMPLETED', finishedAt });
    expect(await database.countStoredRowsOf(importId)).toBe(0);
  });

  it('continuam guardadas quando a importação já tinha falhado e não pode ser concluída', async () => {
    const maria = await database.addUser('Maria');
    const importId = await database.addLeadImport({
      requestedById: maria,
      status: 'FAILED',
      phonesToImport: ['+5511900000001', '+5511900000002'],
    });

    const completedImport = await leadImports.completeLeadImport(importId, finishedAt);

    expect(completedImport).toBeNull();
    expect(await database.findLeadImport(importId)).toMatchObject({ status: 'FAILED' });
    expect(await database.countStoredRowsOf(importId)).toBe(2);
  });

  it('são apagadas quando uma importação que falhou expira', async () => {
    const maria = await database.addUser('Maria');
    const importId = await database.addLeadImport({
      requestedById: maria,
      status: 'FAILED',
      phonesToImport: ['+5511900000001'],
    });

    await leadImports.expireLeadImport(importId);

    expect(await database.findLeadImport(importId)).toMatchObject({ status: 'EXPIRED' });
    expect(await database.countStoredRowsOf(importId)).toBe(0);
  });

  it('continuam guardadas se a importação ainda está em processamento, mesmo que peçam para expirar', async () => {
    const maria = await database.addUser('Maria');
    const importId = await database.addLeadImport({
      requestedById: maria,
      status: 'PROCESSING',
      phonesToImport: ['+5511900000001'],
    });

    const expiredImport = await leadImports.expireLeadImport(importId);

    expect(expiredImport).toBeNull();
    expect(await database.countStoredRowsOf(importId)).toBe(1);
  });
});
