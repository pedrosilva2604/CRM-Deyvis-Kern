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
    const maria = await database.addLead({ name: 'Maria Souza', phone: '+5511900000001' });
    await leads.eraseLead({ leadId: maria, deletedAt: new Date(), deletedById: database.funnel.ownerId });

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
  it('aponta o telefone em uso por um lead ativo', async () => {
    await database.addLead({ name: 'Maria', phone: '+5511900000001' });

    expect(await leads.findContactInUse({ phone: '+5511900000001' }, null)).toBe('phone');
  });

  it('aponta o e-mail em uso quando o telefone está livre', async () => {
    await database.addLead({ name: 'Ana', phone: '+5511900000001', email: 'ana@empresa.com' });

    expect(await leads.findContactInUse({ phone: '+5511900000099', email: 'ana@empresa.com' }, null)).toBe('email');
  });

  it('na edição, ignora o próprio lead', async () => {
    const maria = await database.addLead({ name: 'Maria', phone: '+5511900000001', email: 'maria@empresa.com' });

    expect(await leads.findContactInUse({ email: 'maria@empresa.com' }, maria)).toBeNull();
  });

  it('o telefone e o e-mail de um lead excluído ficam livres para um lead novo', async () => {
    const joao = await database.addLead({ name: 'João', phone: '+5511900000001', email: 'joao@empresa.com' });
    await leads.eraseLead({ leadId: joao, deletedAt: new Date(), deletedById: database.funnel.ownerId });

    expect(await leads.findContactInUse({ phone: '+5511900000001', email: 'joao@empresa.com' }, null)).toBeNull();
  });
});

describe('Excluir um lead (LGPD)', () => {
  it('apaga os dados pessoais e os cartões, e guarda quem excluiu e quando', async () => {
    const joao = await database.addLead({ name: 'João Pereira', phone: '+5511900000001', email: 'joao@empresa.com' });
    await database.client.lead.update({ where: { id: joao }, data: { source: 'Instagram', tags: ['vip'], value: '900.00' } });
    await database.addCard(database.funnel.pipelineId, database.funnel.stageId, joao, 1024);
    const deletedAt = new Date('2026-10-02T18:00:00.000Z');

    await leads.eraseLead({ leadId: joao, deletedAt, deletedById: database.funnel.ownerId });

    expect(await database.findLead(joao)).toMatchObject({
      name: 'Lead excluído',
      phone: null,
      phoneCountry: null,
      email: null,
      source: null,
      tags: [],
      value: null,
      assignedToId: null,
      deletedAt,
      deletedById: database.funnel.ownerId,
    });
    expect(await database.client.pipelineCard.count({ where: { leadId: joao } })).toBe(0);
    expect(await leads.findLeadById(joao)).toBeNull();
  });

  it('guarda as mensagens, com o número e o nome do contato, e as vendas do lead excluído', async () => {
    const joao = await database.addLead({ name: 'João', phone: '+5511900000001' });
    const message = await database.addMessage(joao, 'Quero fechar o plano anual');
    const sale = await database.addSale(joao, '1500.00');

    await leads.eraseLead({ leadId: joao, deletedAt: new Date(), deletedById: database.funnel.ownerId });

    expect(await database.client.message.findUniqueOrThrow({ where: { id: message } })).toMatchObject({
      leadId: joao,
      contactPhone: '+5511900000001',
      contactName: 'João',
      content: 'Quero fechar o plano anual',
    });
    expect(await database.client.sale.findUniqueOrThrow({ where: { id: sale } })).toMatchObject({ leadId: joao });
  });

  it('o banco não deixa apagar de vez um lead que tem mensagens', async () => {
    const joao = await database.addLead({ name: 'João', phone: '+5511900000001' });
    await database.addMessage(joao, 'Oi');

    await expect(database.client.lead.delete({ where: { id: joao } })).rejects.toThrow();
  });

  it('uma edição que chega depois da exclusão não devolve os dados pessoais', async () => {
    const joao = await database.addLead({ name: 'João', phone: '+5511900000001' });
    await leads.eraseLead({ leadId: joao, deletedAt: new Date(), deletedById: database.funnel.ownerId });

    expect(await leads.updateLead(joao, { name: 'João Pereira', phone: '+5511900000001' })).toBe('leadNotFound');
    expect(await database.findLead(joao)).toMatchObject({ name: 'Lead excluído', phone: null });
  });

  it('não atribui o lead a um usuário excluído', async () => {
    const vendedorExcluido = await database.addUser('Vendedor');
    await database.client.user.update({ where: { id: vendedorExcluido }, data: { active: false, deletedAt: new Date() } });
    const maria = await database.addLead({ name: 'Maria', phone: '+5511900000001' });

    expect(await leads.updateLead(maria, { assignedToId: vendedorExcluido })).toBe('assigneeNotAvailable');
    expect(await database.findLead(maria)).toMatchObject({ assignedToId: null });
  });

  it('o banco não deixa um lead ativo ficar sem telefone', async () => {
    const maria = await database.addLead({ name: 'Maria', phone: '+5511900000001' });

    await expect(database.client.lead.update({ where: { id: maria }, data: { phone: null } })).rejects.toThrow();
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
