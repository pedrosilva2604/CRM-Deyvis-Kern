import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ConflictError } from '@/errors/app-errors';
import { LEAD_IMPORT_ERRORS } from '@/errors/errors.constants';
import type { LeadImportChunk } from '@/models/lead-import.model';
import { leadsToCreateFrom, TestDatabase } from '@/testing/integration/test-database';
import { LeadImportChunkAlreadyProcessedError, LeadImportRepository } from './lead-import.repository';

const database = new TestDatabase();
const leadImports = new LeadImportRepository(database.client);
const finishedAt = new Date('2026-09-30T12:00:00.000Z');

function newImportRequestedBy(requestedById: string) {
  return {
    totalRows: 1,
    invalidRows: 0,
    duplicateRowsInFile: 0,
    requestedById,
    ...database.funnel,
    rows: [{ rowNumber: 1, name: 'Lead', phone: '+5511900000001', phoneCountry: 'BR', email: null, enteredOn: finishedAt }],
  };
}

const DISPUTES_TO_CATCH_A_DEADLOCK = 15;

function chunkWithRows(
  importId: string,
  rows: { phone: string; email: string | null }[],
  { importedBy }: { importedBy: 'admin' | 'seller' },
): LeadImportChunk {
  return {
    ...chunkOf(importId, rows.map((row) => row.phone), { importedBy }),
    leadsToCreate: leadsToCreateFrom(rows.map((row) => row.phone), database.funnel).map((lead, rowIndex) => ({
      ...lead,
      email: rows[rowIndex]!.email,
    })),
  };
}

function chunkOf(importId: string, phones: string[], { importedBy }: { importedBy: 'admin' | 'seller' }): LeadImportChunk {
  return {
    importId,
    processedRowsBefore: 0,
    restoresDeletedLeads: importedBy === 'admin',
    leadsToCreate: leadsToCreateFrom(phones, database.funnel),
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

    await leadImports.importChunk(chunkOf(importId, ['+5511900000001', '+5511900000002'], { importedBy: 'seller' }));

    expect(await database.findPhonesOfAllLeads()).toEqual(['+5511900000001', '+5511900000002']);
    expect(await database.findLeadImport(importId)).toMatchObject({ processedRows: 2, importedLeads: 2 });
  });

  it('não duplica o lead cujo telefone já está no CRM e conta como "já existia"', async () => {
    const maria = await database.addUser('Maria');
    await database.addLead({ name: 'Cliente antigo', phone: '+5511900000001' });
    const importId = await database.addLeadImport({ requestedById: maria, status: 'PROCESSING' });

    const chunkResult = await leadImports.importChunk(chunkOf(importId, ['+5511900000001', '+5511900000002'], { importedBy: 'seller' }));

    expect(chunkResult).toEqual({ insertedLeads: 1, restoredLeads: 0, skippedDeletedLeads: 0 });
    expect(await database.findPhonesOfAllLeads()).toEqual(['+5511900000001', '+5511900000002']);
    expect(await database.findLeadImport(importId)).toMatchObject({ importedLeads: 1, skippedExistingLeads: 1 });
  });

  it('recusa o pedaço que outra execução já gravou e desfaz os leads que tentou inserir', async () => {
    const maria = await database.addUser('Maria');
    const importId = await database.addLeadImport({ requestedById: maria, status: 'PROCESSING' });
    await leadImports.importChunk(chunkOf(importId, ['+5511900000001'], { importedBy: 'seller' }));

    const secondExecution = leadImports.importChunk(chunkOf(importId, ['+5511900000099'], { importedBy: 'seller' }));

    await expect(secondExecution).rejects.toBeInstanceOf(LeadImportChunkAlreadyProcessedError);
    expect(await database.findPhonesOfAllLeads()).toEqual(['+5511900000001']);
    expect(await database.findLeadImport(importId)).toMatchObject({ processedRows: 1, importedLeads: 1 });
  });
});

describe('Telefones de leads excluídos na importação', () => {
  it('importação de ADMIN restaura o lead excluído, sem criar outro', async () => {
    const ana = await database.addUser('Ana', { role: 'ADMIN' });
    await database.addLead({ name: 'Cliente excluído', phone: '+5511900000001', deleted: true });
    const importId = await database.addLeadImport({ requestedById: ana, status: 'PROCESSING' });

    const chunkResult = await leadImports.importChunk(chunkOf(importId, ['+5511900000001', '+5511900000002'], { importedBy: 'admin' }));

    expect(chunkResult).toEqual({ insertedLeads: 1, restoredLeads: 1, skippedDeletedLeads: 0 });
    expect(await database.findLeadByPhone('+5511900000001')).toMatchObject({ name: 'Cliente excluído', deletedAt: null });
    expect(await database.findLeadImport(importId)).toMatchObject({ importedLeads: 1, restoredLeads: 1, skippedExistingLeads: 0 });
  });

  it('importação de vendedor não restaura e conta à parte, sem misturar com "já existia"', async () => {
    const maria = await database.addUser('Maria');
    await database.addLead({ name: 'Cliente excluído', phone: '+5511900000001', deleted: true });
    await database.addLead({ name: 'Cliente ativo', phone: '+5511900000002' });
    const importId = await database.addLeadImport({ requestedById: maria, status: 'PROCESSING' });

    const chunkResult = await leadImports.importChunk(
      chunkOf(importId, ['+5511900000001', '+5511900000002', '+5511900000003'], { importedBy: 'seller' }),
    );

    expect(chunkResult).toEqual({ insertedLeads: 1, restoredLeads: 0, skippedDeletedLeads: 1 });
    expect(await database.findLeadByPhone('+5511900000001')).toMatchObject({ deletedAt: expect.any(Date) });
    expect(await database.findLeadImport(importId)).toMatchObject({
      importedLeads: 1,
      skippedDeletedLeads: 1,
      skippedExistingLeads: 1,
      restoredLeads: 0,
    });
  });
});

describe('Lead excluído reconhecido pelo e-mail na importação', () => {
  it('importação de ADMIN restaura o João pelo e-mail, e o telefone novo da planilha passa a ser o dele', async () => {
    const ana = await database.addUser('Ana', { role: 'ADMIN' });
    await database.addLead({ name: 'João excluído', phone: '+5511900000001', email: 'joao@empresa.com', deleted: true });
    const importId = await database.addLeadImport({ requestedById: ana, status: 'PROCESSING' });

    const chunkResult = await leadImports.importChunk(
      chunkWithRows(importId, [{ phone: '+5511900000099', email: 'joao@empresa.com' }], { importedBy: 'admin' }),
    );

    expect(chunkResult).toEqual({ insertedLeads: 0, restoredLeads: 1, skippedDeletedLeads: 0 });
    expect(await database.findLeadByPhone('+5511900000099')).toMatchObject({ name: 'João excluído', deletedAt: null });
  });

  it.each([
    ['primeiro a linha com o telefone atual', [{ phone: '+5511900000001', email: null }, { phone: '+5511900000099', email: 'joao@empresa.com' }]],
    ['primeiro a linha com o telefone novo', [{ phone: '+5511900000099', email: 'joao@empresa.com' }, { phone: '+5511900000001', email: null }]],
  ])('se alguma linha confirma o telefone atual do João, ele continua com esse telefone (%s)', async (_order, rows) => {
    const ana = await database.addUser('Ana', { role: 'ADMIN' });
    await database.addLead({ name: 'João excluído', phone: '+5511900000001', email: 'joao@empresa.com', deleted: true });
    const importId = await database.addLeadImport({ requestedById: ana, status: 'PROCESSING' });

    await leadImports.importChunk(chunkWithRows(importId, rows, { importedBy: 'admin' }));

    expect(await database.findLeadByPhone('+5511900000001')).toMatchObject({ name: 'João excluído', deletedAt: null });
  });

  it('duas linhas do mesmo João contam um restaurado e um "já existia"', async () => {
    const ana = await database.addUser('Ana', { role: 'ADMIN' });
    await database.addLead({ name: 'João excluído', phone: '+5511900000001', email: 'joao@empresa.com', deleted: true });
    const importId = await database.addLeadImport({ requestedById: ana, status: 'PROCESSING' });

    const chunkResult = await leadImports.importChunk(
      chunkWithRows(
        importId,
        [
          { phone: '+5511900000001', email: 'outro-email@empresa.com' },
          { phone: '+5511900000099', email: 'joao@empresa.com' },
        ],
        { importedBy: 'admin' },
      ),
    );

    expect(chunkResult).toEqual({ insertedLeads: 0, restoredLeads: 1, skippedDeletedLeads: 0 });
    expect(await database.findLeadImport(importId)).toMatchObject({ restoredLeads: 1, skippedExistingLeads: 1 });
  });

  it('importação de vendedor conta a linha como "pertence a lead excluído", e não como "já existia"', async () => {
    const maria = await database.addUser('Maria');
    await database.addLead({ name: 'João excluído', phone: '+5511900000001', email: 'joao@empresa.com', deleted: true });
    const importId = await database.addLeadImport({ requestedById: maria, status: 'PROCESSING' });

    await leadImports.importChunk(chunkWithRows(importId, [{ phone: '+5511900000099', email: 'joao@empresa.com' }], { importedBy: 'seller' }));

    expect(await database.findLeadImport(importId)).toMatchObject({ skippedDeletedLeads: 1, skippedExistingLeads: 0 });
  });

  it('telefone de lead ativo e e-mail de lead excluído: conta como "já existia" e não restaura ninguém', async () => {
    const ana = await database.addUser('Ana', { role: 'ADMIN' });
    await database.addLead({ name: 'Maria ativa', phone: '+5511900000001' });
    await database.addLead({ name: 'João excluído', phone: '+5511900000002', email: 'joao@empresa.com', deleted: true });
    const importId = await database.addLeadImport({ requestedById: ana, status: 'PROCESSING' });

    const chunkResult = await leadImports.importChunk(
      chunkWithRows(importId, [{ phone: '+5511900000001', email: 'joao@empresa.com' }], { importedBy: 'admin' }),
    );

    expect(chunkResult).toEqual({ insertedLeads: 0, restoredLeads: 0, skippedDeletedLeads: 0 });
    expect(await database.findLeadImport(importId)).toMatchObject({ skippedExistingLeads: 1 });
    expect(await database.findLeadByPhone('+5511900000002')).toMatchObject({ deletedAt: expect.any(Date) });
  });
});

describe('Duas importações gravando os mesmos telefones ao mesmo tempo', () => {
  it('a de ADMIN restaurando e a de vendedor inserindo terminam as duas, sem deadlock (em 15 disputas)', async () => {
    const phones = Array.from({ length: 40 }, (_, phoneIndex) => `+55119000${String(phoneIndex).padStart(5, '0')}`);
    const deletedPhones = phones.filter((_, phoneIndex) => phoneIndex % 2 === 1);
    const failures: string[] = [];

    for (let dispute = 1; dispute <= DISPUTES_TO_CATCH_A_DEADLOCK; dispute += 1) {
      await database.prepareEmptyDatabase();
      for (const phone of deletedPhones) await database.addLead({ name: `Excluído ${phone}`, phone, deleted: true });
      const ana = await database.addUser('Ana', { role: 'ADMIN' });
      const maria = await database.addUser('Maria');
      const adminImport = await database.addLeadImport({ requestedById: ana, status: 'PROCESSING' });
      const sellerImport = await database.addLeadImport({ requestedById: maria, status: 'PROCESSING' });

      const outcomes = await Promise.allSettled([
        leadImports.importChunk(chunkOf(adminImport, phones, { importedBy: 'admin' })),
        leadImports.importChunk(chunkOf(sellerImport, phones, { importedBy: 'seller' })),
      ]);

      outcomes.forEach((outcome) => outcome.status === 'rejected' && failures.push(String(outcome.reason).split('\n')[0]!));
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
