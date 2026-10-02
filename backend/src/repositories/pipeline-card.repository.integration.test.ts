import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ConflictError } from '@/errors/app-errors';
import { PIPELINE_ERRORS } from '@/errors/errors.constants';
import { TestDatabase, type TestPipeline } from '@/testing/integration/test-database';
import { PipelineCardRepository } from './pipeline-card.repository';

const database = new TestDatabase();
const cards = new PipelineCardRepository(database.client);
const keepClosing = undefined;

let funnel: TestPipeline;
let newStage: string;
let proposalStage: string;

async function addLeadWithCard(name: string, phone: string, stageId: string, position: number): Promise<string> {
  const leadId = await database.addLead({ name, phone });
  return await database.addCard(funnel.pipelineId, stageId, leadId, position);
}

beforeEach(async () => {
  await database.prepareEmptyDatabase();
  const maria = await database.addUser('Maria');
  funnel = await database.addPipeline(maria, ['Novo lead', 'Proposta']);
  newStage = funnel.stageIdByName['Novo lead']!;
  proposalStage = funnel.stageIdByName['Proposta']!;
});

afterAll(async () => {
  await database.disconnect();
});

describe('Adicionar lead da base ao funil', () => {
  it('entra no topo da etapa', async () => {
    await addLeadWithCard('Ana', '+5511900000001', newStage, 1024);
    const bruno = await database.addLead({ name: 'Bruno', phone: '+5511900000002' });

    await cards.addCardOnTop({ pipelineId: funnel.pipelineId, stageId: newStage, leadId: bruno, addedById: null });

    expect(await database.findLeadNamesInStageOrder(newStage)).toEqual(['Bruno', 'Ana']);
  });

  it('vários leads adicionados ao mesmo tempo ganham posições diferentes', async () => {
    const leadIds = await Promise.all(
      Array.from({ length: 12 }, (_, leadIndex) =>
        database.addLead({ name: `Lead ${leadIndex}`, phone: `+55119000001${String(leadIndex).padStart(2, '0')}` }),
      ),
    );

    await Promise.all(leadIds.map((leadId) => cards.addCardOnTop({ pipelineId: funnel.pipelineId, stageId: newStage, leadId, addedById: null })));

    const positions = await database.findCardPositionsOfStage(newStage);
    expect(new Set(positions).size).toBe(leadIds.length);
  });

  it('não deixa o mesmo lead entrar duas vezes no mesmo funil', async () => {
    const ana = await database.addLead({ name: 'Ana', phone: '+5511900000001' });
    await cards.addCardOnTop({ pipelineId: funnel.pipelineId, stageId: newStage, leadId: ana, addedById: null });

    const secondTime = cards.addCardOnTop({ pipelineId: funnel.pipelineId, stageId: proposalStage, leadId: ana, addedById: null });

    await expect(secondTime).rejects.toBeInstanceOf(ConflictError);
    await expect(secondTime).rejects.toThrow(PIPELINE_ERRORS.LEAD_ALREADY_IN_PIPELINE);
  });

  it('o mesmo lead pode estar no funil de outra pessoa', async () => {
    const joao = await database.addUser('João');
    const funnelOfJoao = await database.addPipeline(joao, ['Novo lead']);
    const ana = await database.addLead({ name: 'Ana', phone: '+5511900000001' });
    await cards.addCardOnTop({ pipelineId: funnel.pipelineId, stageId: newStage, leadId: ana, addedById: null });

    await cards.addCardOnTop({ pipelineId: funnelOfJoao.pipelineId, stageId: funnelOfJoao.stageIdByName['Novo lead']!, leadId: ana, addedById: null });

    expect(await database.findLeadNamesInStageOrder(funnelOfJoao.stageIdByName['Novo lead']!)).toEqual(['Ana']);
  });
});

describe('Arrastar cartões', () => {
  it('encaixa entre dois cartões de outra etapa', async () => {
    const cardOfAna = await addLeadWithCard('Ana', '+5511900000001', proposalStage, 1024);
    await addLeadWithCard('Carla', '+5511900000003', proposalStage, 2048);
    const cardOfBruno = await addLeadWithCard('Bruno', '+5511900000002', newStage, 1024);

    await cards.moveCard(cardOfBruno, { stageId: proposalStage, previousCardId: cardOfAna, closing: keepClosing });

    expect(await database.findLeadNamesInStageOrder(proposalStage)).toEqual(['Ana', 'Bruno', 'Carla']);
    expect(await database.findLeadNamesInStageOrder(newStage)).toEqual([]);
  });

  it('move para o topo quando não há cartão de referência', async () => {
    await addLeadWithCard('Ana', '+5511900000001', newStage, 1024);
    const cardOfBruno = await addLeadWithCard('Bruno', '+5511900000002', newStage, 2048);

    await cards.moveCard(cardOfBruno, { stageId: newStage, previousCardId: null, closing: keepClosing });

    expect(await database.findLeadNamesInStageOrder(newStage)).toEqual(['Bruno', 'Ana']);
  });

  it('continua ordenando certo mesmo quando o espaço entre dois cartões acaba', async () => {
    const cardOfAna = await addLeadWithCard('Ana', '+5511900000001', newStage, 1000);
    await addLeadWithCard('Carla', '+5511900000003', newStage, 1000.0000001);
    const cardOfBruno = await addLeadWithCard('Bruno', '+5511900000002', proposalStage, 1024);

    await cards.moveCard(cardOfBruno, { stageId: newStage, previousCardId: cardOfAna, closing: keepClosing });

    expect(await database.findLeadNamesInStageOrder(newStage)).toEqual(['Ana', 'Bruno', 'Carla']);
  });

  it('guarda o valor e a anotação ao fechar, e mantém ao só reordenar', async () => {
    const cardOfAna = await addLeadWithCard('Ana', '+5511900000001', newStage, 1024);
    const closedAt = new Date('2026-10-02T12:00:00.000Z');

    await cards.moveCard(cardOfAna, {
      stageId: proposalStage,
      previousCardId: null,
      closing: { wonValue: '1500.00', closingNote: 'Fechou no plano anual', closedAt },
    });
    await cards.moveCard(cardOfAna, { stageId: proposalStage, previousCardId: null, closing: keepClosing });

    expect(await database.findCard(cardOfAna)).toMatchObject({ closingNote: 'Fechou no plano anual', closedAt });
    expect((await database.findCard(cardOfAna)).wonValue?.toFixed(2)).toBe('1500.00');
  });
});

describe('Página de cartões de uma etapa', () => {
  it('esconde os leads excluídos e diz quantos existem', async () => {
    await addLeadWithCard('Ana', '+5511900000001', newStage, 1024);
    const excluded = await database.addLead({ name: 'Excluído', phone: '+5511900000002', deleted: true });
    await database.addCard(funnel.pipelineId, newStage, excluded, 2048);

    const page = await cards.findStageCardsPage(newStage, { afterPosition: null, limit: 50 });

    expect(page.cards.map((card) => card.lead.name)).toEqual(['Ana']);
    expect(page.totalCards).toBe(1);
  });

  it('entrega em páginas, continuando de onde parou', async () => {
    for (const [index, name] of ['A', 'B', 'C'].entries()) await addLeadWithCard(name, `+551190000000${index}`, newStage, 1024 * (index + 1));

    const firstPage = await cards.findStageCardsPage(newStage, { afterPosition: null, limit: 2 });
    const secondPage = await cards.findStageCardsPage(newStage, { afterPosition: firstPage.nextAfterPosition, limit: 2 });

    expect(firstPage.cards.map((card) => card.lead.name)).toEqual(['A', 'B']);
    expect(secondPage.cards.map((card) => card.lead.name)).toEqual(['C']);
    expect(secondPage.nextAfterPosition).toBeNull();
  });
});
