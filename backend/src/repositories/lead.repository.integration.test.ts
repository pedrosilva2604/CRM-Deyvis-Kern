import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { LeadSearch } from '@/models/lead.model';
import { TestDatabase } from '@/testing/integration/test-database';
import { LeadRepository } from './lead.repository';

const database = new TestDatabase();
const leads = new LeadRepository(database.client);

async function namesFoundBy(search: LeadSearch): Promise<string[]> {
  const leadListPage = await leads.findLeadsPage({ search, page: 1, pageSize: 20 });
  return leadListPage.leads.map((lead) => lead.name).sort();
}

function searchByWords(words: string): LeadSearch {
  return { searchedBy: 'words', words };
}

function searchByPhone(internationalPhone: string): LeadSearch {
  return { searchedBy: 'phone', internationalPhone };
}

beforeEach(async () => {
  await database.prepareEmptyDatabase();
});

afterAll(async () => {
  await database.disconnect();
});

describe('Busca de leads por nome e e-mail', () => {
  it('procura a palavra inteira: "maria" encontra Maria, mas não Mariana', async () => {
    await database.addLead({ name: 'Maria Souza', phone: '+5511900000001' });
    await database.addLead({ name: 'Mariana Lima', phone: '+5511900000002' });

    expect(await namesFoundBy(searchByWords('maria'))).toEqual(['Maria Souza']);
  });

  it('ignora acentos e maiúsculas: "joao" encontra João', async () => {
    await database.addLead({ name: 'João Pereira', phone: '+5511900000001' });

    expect(await namesFoundBy(searchByWords('JOAO'))).toEqual(['João Pereira']);
  });

  it('exige todas as palavras digitadas', async () => {
    await database.addLead({ name: 'Maria Souza', phone: '+5511900000001' });
    await database.addLead({ name: 'Maria Lima', phone: '+5511900000002' });

    expect(await namesFoundBy(searchByWords('maria lima'))).toEqual(['Maria Lima']);
  });

  it('encontra pelo e-mail completo', async () => {
    await database.addLead({ name: 'Maria Souza', phone: '+5511900000001', email: 'maria.souza@empresa.com' });
    await database.addLead({ name: 'Outra pessoa', phone: '+5511900000002', email: 'outra@empresa.com' });

    expect(await namesFoundBy(searchByWords('maria.souza@empresa.com'))).toEqual(['Maria Souza']);
  });

  it('não mostra leads excluídos', async () => {
    await database.addLead({ name: 'Maria Souza', phone: '+5511900000001', deleted: true });

    expect(await namesFoundBy(searchByWords('maria'))).toEqual([]);
  });

  it('trata o texto digitado como dado, não como SQL', async () => {
    await database.addLead({ name: 'Maria Souza', phone: '+5511900000001' });

    expect(await namesFoundBy(searchByWords(`maria'); DROP TABLE "Lead"; --`))).toEqual([]);
    expect(await database.findPhonesOfAllLeads()).toEqual(['+5511900000001']);
  });
});

describe('Busca de leads por telefone', () => {
  it('encontra somente o número exato', async () => {
    await database.addLead({ name: 'Maria Souza', phone: '+5511900000001' });
    await database.addLead({ name: 'João Pereira', phone: '+5511900000010' });

    expect(await namesFoundBy(searchByPhone('+5511900000001'))).toEqual(['Maria Souza']);
  });

  it('não encontra nada com parte do número', async () => {
    await database.addLead({ name: 'Maria Souza', phone: '+5511900000001' });

    expect(await namesFoundBy(searchByPhone('+55119000'))).toEqual([]);
  });
});

describe('Quem já tem o telefone ou o e-mail', () => {
  it('aponta o lead excluído que tem o telefone', async () => {
    const deletedLead = await database.addLead({ name: 'Excluído', phone: '+5511900000001', deleted: true });

    expect(await leads.findLeadHoldingContact({ phone: '+5511900000001' }, null)).toEqual({
      leadId: deletedLead,
      heldContact: 'phone',
      isDeleted: true,
    });
  });

  it('aponta o lead excluído que tem o e-mail', async () => {
    const deletedLead = await database.addLead({ name: 'Excluído', phone: '+5511900000001', email: 'ana@empresa.com', deleted: true });

    expect(await leads.findLeadHoldingContact({ phone: '+5511900000099', email: 'ana@empresa.com' }, null)).toEqual({
      leadId: deletedLead,
      heldContact: 'email',
      isDeleted: true,
    });
  });

  it('com telefone de lead ativo e e-mail de lead excluído, aponta o ativo: restaurar não destravaria o cadastro', async () => {
    const maria = await database.addLead({ name: 'Maria (ativa)', phone: '+5511900000001' });
    await database.addLead({ name: 'João (excluído)', phone: '+5511900000002', email: 'joao@empresa.com', deleted: true });

    expect(await leads.findLeadHoldingContact({ phone: '+5511900000001', email: 'joao@empresa.com' }, null)).toEqual({
      leadId: maria,
      heldContact: 'phone',
      isDeleted: false,
    });
  });

  it('telefone e e-mail de dois leads excluídos diferentes: aponta o lead do telefone', async () => {
    await database.addLead({ name: 'Excluído do e-mail', phone: '+5511900000002', email: 'ana@empresa.com', deleted: true });
    const deletedLeadOfPhone = await database.addLead({ name: 'Excluído do telefone', phone: '+5511900000001', deleted: true });

    expect(await leads.findLeadHoldingContact({ phone: '+5511900000001', email: 'ana@empresa.com' }, null)).toEqual({
      leadId: deletedLeadOfPhone,
      heldContact: 'phone',
      isDeleted: true,
    });
  });

  it('na edição, ignora o próprio lead', async () => {
    const maria = await database.addLead({ name: 'Maria', phone: '+5511900000001', email: 'maria@empresa.com' });

    expect(await leads.findLeadHoldingContact({ email: 'maria@empresa.com' }, maria)).toBeNull();
  });
  it('restaura o lead excluído com o histórico dele', async () => {
    const deletedLead = await database.addLead({ name: 'Excluído', phone: '+5511900000001', deleted: true });

    expect(await leads.restoreDeletedLead(deletedLead)).toBe(true);
    expect(await leads.findLeadById(deletedLead)).toMatchObject({ name: 'Excluído', phone: '+5511900000001' });
  });

  it('não "restaura" um lead que não está excluído', async () => {
    const activeLead = await database.addLead({ name: 'Ativo', phone: '+5511900000001' });

    expect(await leads.restoreDeletedLead(activeLead)).toBe(false);
  });
});

describe('Paginação da lista de leads', () => {
  it('informa o total encontrado mesmo mostrando só uma página', async () => {
    await database.addLead({ name: 'Lead 1', phone: '+5511900000001' });
    await database.addLead({ name: 'Lead 2', phone: '+5511900000002' });
    await database.addLead({ name: 'Lead 3', phone: '+5511900000003' });

    const secondPage = await leads.findLeadsPage({ page: 2, pageSize: 2 });

    expect(secondPage.totalMatchingLeads).toBe(3);
    expect(secondPage.leads).toHaveLength(1);
  });
});
