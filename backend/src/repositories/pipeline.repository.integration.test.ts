import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MAXIMUM_STAGES_PER_PIPELINE } from '@/constants/pipeline-limits';
import { NotFoundError } from '@/errors/app-errors';
import { TestDatabase, type TestPipeline } from '@/testing/integration/test-database';
import { CARD_POSITION_GAP, PipelineCardRepository } from './pipeline-card.repository';
import { PipelineRepository } from './pipeline.repository';
import { UserRepository } from './user.repository';

const database = new TestDatabase();
const pipelines = new PipelineRepository(database.client);
const cards = new PipelineCardRepository(database.client);
const users = new UserRepository(database.client);
const DISPUTES_TO_CATCH_A_RACE = 20;
const CARDS_ALREADY_IN_FUNNEL = 10;
const SLOW_DISPUTE_TIMEOUT_MS = 120_000;

beforeEach(async () => {
  await database.prepareEmptyDatabase();
});

afterAll(async () => {
  await database.disconnect();
});

describe('Quem enxerga cada funil', () => {
  it('o vendedor vê os funis dele e os que foi convidado; o ADMIN vê todos', async () => {
    const maria = await database.addUser('Maria');
    const joao = await database.addUser('João');
    const funnelOfMaria = await database.addPipeline(maria, ['Novo lead']);
    const funnelOfJoao = await database.addPipeline(joao, ['Novo lead']);
    await database.addPipeline(joao, ['Novo lead']);
    await database.addMember(funnelOfJoao.pipelineId, maria);

    const visibleToMaria = await pipelines.findPipelinesVisibleTo({ userId: maria, isAdmin: false });
    const visibleToAdmin = await pipelines.findPipelinesVisibleTo({ userId: 'qualquer-admin', isAdmin: true });

    expect(visibleToMaria.map((pipeline) => pipeline.id).sort()).toEqual([funnelOfMaria.pipelineId, funnelOfJoao.pipelineId].sort());
    expect(visibleToAdmin.map((pipeline) => pipeline.id)).toEqual(
      expect.arrayContaining([database.funnel.pipelineId, funnelOfMaria.pipelineId, funnelOfJoao.pipelineId]),
    );
    expect(visibleToAdmin).toHaveLength(4);
  });

  it('diz o nível de acesso de cada pessoa', async () => {
    const maria = await database.addUser('Maria');
    const joao = await database.addUser('João');
    const carla = await database.addUser('Carla');
    const funnelOfMaria = await database.addPipeline(maria, ['Novo lead']);
    await database.addMember(funnelOfMaria.pipelineId, joao);

    expect(await pipelines.findPipelineAccess(funnelOfMaria.pipelineId, { userId: maria, isAdmin: false })).toMatchObject({ level: 'owner' });
    expect(await pipelines.findPipelineAccess(funnelOfMaria.pipelineId, { userId: joao, isAdmin: false })).toMatchObject({ level: 'member' });
    expect(await pipelines.findPipelineAccess(funnelOfMaria.pipelineId, { userId: carla, isAdmin: false })).toBeNull();
    expect(await pipelines.findPipelineAccess(funnelOfMaria.pipelineId, { userId: carla, isAdmin: true })).toMatchObject({ level: 'admin' });
  });

  it('avisa em tempo real o dono, os participantes e os admins ativos, e mais ninguém', async () => {
    const maria = await database.addUser('Maria');
    const joao = await database.addUser('João');
    const ana = await database.addUser('Ana', { role: 'ADMIN' });
    await database.addUser('Carla');
    await database.addUser('Admin desativado', { role: 'ADMIN', active: false });
    const funnelOfMaria = await database.addPipeline(maria, ['Novo lead']);
    await database.addMember(funnelOfMaria.pipelineId, joao);

    expect((await pipelines.findPeopleWithAccess(funnelOfMaria.pipelineId)).sort()).toEqual([maria, joao, ana].sort());
  });

  it('só oferece para convite vendedores ativos que ainda não participam', async () => {
    const maria = await database.addUser('Maria');
    const joao = await database.addUser('João');
    await database.addUser('Carla');
    await database.addUser('Ana', { role: 'ADMIN' });
    await database.addUser('Inativo', { active: false });
    const funnelOfMaria = await database.addPipeline(maria, ['Novo lead']);
    await database.addMember(funnelOfMaria.pipelineId, joao);

    const invitable = await pipelines.findInvitableUsers(funnelOfMaria.pipelineId);

    expect(invitable.map((user) => user.name)).toEqual(['Carla', 'Dono do funil de teste']);
  });
});

describe('Excluir uma etapa', () => {
  it('leva os cartões para o fim da etapa escolhida, na mesma ordem', async () => {
    const maria = await database.addUser('Maria');
    const funnel = await database.addPipeline(maria, ['Novo lead', 'Proposta']);
    const proposalStage = funnel.stageIdByName['Proposta']!;
    const newStage = funnel.stageIdByName['Novo lead']!;
    await database.addCard(funnel.pipelineId, proposalStage, await database.addLead({ name: 'Já estava', phone: '+5511900000001' }), 1024);
    await database.addCard(funnel.pipelineId, newStage, await database.addLead({ name: 'Primeiro', phone: '+5511900000002' }), 1024);
    await database.addCard(funnel.pipelineId, newStage, await database.addLead({ name: 'Segundo', phone: '+5511900000003' }), 2048);

    await pipelines.deleteStageMovingCards(funnel.pipelineId, newStage, proposalStage);

    expect(await database.findLeadNamesInStageOrder(proposalStage)).toEqual(['Já estava', 'Primeiro', 'Segundo']);
  });
});

describe('Excluir uma etapa ajusta o fechamento dos cartões à etapa que recebe', () => {
  const closedOn = new Date('2026-09-01T12:00:00.000Z');
  let funnel: TestPipeline;
  let wonCard: string;

  beforeEach(async () => {
    const maria = await database.addUser('Maria');
    funnel = await database.addPipeline(maria, ['Proposta', 'Ganho', 'Outro ganho', 'Perdido'], { wonStage: 'Ganho', lostStage: 'Perdido' });
    await database.client.stage.update({ where: { id: funnel.stageIdByName['Outro ganho']! }, data: { isWon: true } });
    const lead = await database.addLead({ name: 'Vendido', phone: '+5511900000001' });
    wonCard = await database.addCard(funnel.pipelineId, funnel.stageIdByName['Ganho']!, lead, 1024);
    await database.client.pipelineCard.update({
      where: { id: wonCard },
      data: { wonValue: '1500.00', closingNote: 'Pagou à vista', closedAt: closedOn },
    });
  });

  it('indo para uma etapa aberta, deixa de parecer vendido', async () => {
    await pipelines.deleteStageMovingCards(funnel.pipelineId, funnel.stageIdByName['Ganho']!, funnel.stageIdByName['Proposta']!);

    expect(await database.findCard(wonCard)).toMatchObject({ wonValue: null, closingNote: null, closedAt: null });
  });

  it('indo para Perdido, perde o valor, mantém a anotação e fecha agora', async () => {
    await pipelines.deleteStageMovingCards(funnel.pipelineId, funnel.stageIdByName['Ganho']!, funnel.stageIdByName['Perdido']!);

    const card = await database.findCard(wonCard);
    expect(card).toMatchObject({ wonValue: null, closingNote: 'Pagou à vista' });
    expect(card.closedAt!.getTime()).toBeGreaterThan(closedOn.getTime());
  });

  it('indo de um Ganho para outro, mantém valor, anotação e data', async () => {
    await pipelines.deleteStageMovingCards(funnel.pipelineId, funnel.stageIdByName['Ganho']!, funnel.stageIdByName['Outro ganho']!);

    const card = await database.findCard(wonCard);
    expect(card.wonValue?.toFixed(2)).toBe('1500.00');
    expect(card).toMatchObject({ closingNote: 'Pagou à vista', closedAt: closedOn });
  });

  it('desmarcar uma etapa de Ganho tira dos cartões a cara de vendido', async () => {
    expect(await pipelines.updateStage(funnel.stageIdByName['Ganho']!, { isWon: false })).toBe('updated');

    expect(await database.findCard(wonCard)).toMatchObject({ wonValue: null, closingNote: null, closedAt: null });
  });

  it('trocar uma etapa de Ganho para Perdido tira o valor e mantém a anotação', async () => {
    await pipelines.updateStage(funnel.stageIdByName['Ganho']!, { isWon: false, isLost: true });

    expect(await database.findCard(wonCard)).toMatchObject({ wonValue: null, closingNote: 'Pagou à vista' });
  });

  it('não marca como Ganho uma etapa com cartão sem valor de venda, e não muda nada', async () => {
    const lead = await database.addLead({ name: 'Negociando', phone: '+5511900000002' });
    await database.addCard(funnel.pipelineId, funnel.stageIdByName['Proposta']!, lead, 1024);

    expect(await pipelines.updateStage(funnel.stageIdByName['Proposta']!, { isWon: true, isLost: false })).toBe('cardsWithoutWonValue');
    expect(await database.client.stage.findUniqueOrThrow({ where: { id: funnel.stageIdByName['Proposta']! } })).toMatchObject({ isWon: false });
  });

  it('renomear uma etapa de Ganho não mexe nos cartões', async () => {
    await pipelines.updateStage(funnel.stageIdByName['Ganho']!, { name: 'Vendido' });

    const card = await database.findCard(wonCard);
    expect(card.wonValue?.toFixed(2)).toBe('1500.00');
    expect(card).toMatchObject({ closingNote: 'Pagou à vista', closedAt: closedOn });
  });

  it('não leva para Ganho cartão sem valor de venda, e não muda nada', async () => {
    const lead = await database.addLead({ name: 'Negociando', phone: '+5511900000002' });
    const openCard = await database.addCard(funnel.pipelineId, funnel.stageIdByName['Proposta']!, lead, 1024);

    const outcome = await pipelines.deleteStageMovingCards(funnel.pipelineId, funnel.stageIdByName['Proposta']!, funnel.stageIdByName['Ganho']!);

    expect(outcome).toBe('cardsWithoutWonValue');
    expect(await database.findCard(openCard)).toMatchObject({ stageId: funnel.stageIdByName['Proposta']! });
  });
});

describe('Duas pessoas mexendo nas etapas do mesmo funil ao mesmo tempo (em 20 disputas)', () => {
  const newStage = { name: 'Nova', color: '#123456', isWon: false, isLost: false };

  async function funnelWithStages(stageCount: number): Promise<TestPipeline> {
    const maria = await database.addUser('Maria');
    return await database.addPipeline(maria, Array.from({ length: stageCount }, (_, stageIndex) => `Etapa ${stageIndex + 1}`));
  }

  async function findStagePositions(pipelineId: string): Promise<number[]> {
    const stages = await database.client.stage.findMany({ where: { pipelineId }, select: { position: true } });
    return stages.map(({ position }) => position);
  }

  it('criar e criar com 29 etapas termina sempre em 30, sem posição repetida', async () => {
    for (let dispute = 1; dispute <= DISPUTES_TO_CATCH_A_RACE; dispute += 1) {
      await database.prepareEmptyDatabase();
      const funnel = await funnelWithStages(MAXIMUM_STAGES_PER_PIPELINE - 1);

      const outcomes = await Promise.all([pipelines.createStage(funnel.pipelineId, newStage), pipelines.createStage(funnel.pipelineId, newStage)]);

      const positions = await findStagePositions(funnel.pipelineId);
      expect(outcomes.sort()).toEqual(['created', 'tooManyStages']);
      expect(positions).toHaveLength(MAXIMUM_STAGES_PER_PIPELINE);
      expect(new Set(positions).size).toBe(positions.length);
    }
  }, SLOW_DISPUTE_TIMEOUT_MS);

  it('excluir e excluir as duas últimas etapas sempre deixa uma', async () => {
    for (let dispute = 1; dispute <= DISPUTES_TO_CATCH_A_RACE; dispute += 1) {
      await database.prepareEmptyDatabase();
      const funnel = await funnelWithStages(2);
      const [firstStage, secondStage] = [funnel.stageIdByName['Etapa 1']!, funnel.stageIdByName['Etapa 2']!];

      const outcomes = await Promise.all([
        pipelines.deleteStageMovingCards(funnel.pipelineId, firstStage, secondStage),
        pipelines.deleteStageMovingCards(funnel.pipelineId, secondStage, firstStage),
      ]);

      expect(outcomes.filter((outcome) => outcome === 'deleted')).toHaveLength(1);
      expect(await findStagePositions(funnel.pipelineId)).toHaveLength(1);
    }
  }, SLOW_DISPUTE_TIMEOUT_MS);

  it('criar e excluir com 30 etapas termina com o número certo para a ordem em que foram atendidos', async () => {
    for (let dispute = 1; dispute <= DISPUTES_TO_CATCH_A_RACE; dispute += 1) {
      await database.prepareEmptyDatabase();
      const funnel = await funnelWithStages(MAXIMUM_STAGES_PER_PIPELINE);

      const [creation, deletion] = await Promise.all([
        pipelines.createStage(funnel.pipelineId, newStage),
        pipelines.deleteStageMovingCards(funnel.pipelineId, funnel.stageIdByName['Etapa 1']!, funnel.stageIdByName['Etapa 2']!),
      ]);

      const positions = await findStagePositions(funnel.pipelineId);
      expect(deletion).toBe('deleted');
      expect(positions).toHaveLength(creation === 'created' ? MAXIMUM_STAGES_PER_PIPELINE : MAXIMUM_STAGES_PER_PIPELINE - 1);
      expect(new Set(positions).size).toBe(positions.length);
    }
  }, SLOW_DISPUTE_TIMEOUT_MS);

  it('reordenar sem conhecer a etapa que acabou de ser criada é recusado', async () => {
    const funnel = await funnelWithStages(3);
    const stagesBeforeCreation = Object.values(funnel.stageIdByName);
    await pipelines.createStage(funnel.pipelineId, newStage);

    expect(await pipelines.reorderStages(funnel.pipelineId, [...stagesBeforeCreation].reverse())).toBe('stageOrderInvalid');
  });
});

describe('Excluir um funil', () => {
  it('excluir o funil enquanto alguém adiciona cartão nele sempre exclui; o cartão entra antes ou recebe 404 (em 20 disputas)', async () => {
    const unexpectedFailures: string[] = [];

    for (let dispute = 1; dispute <= DISPUTES_TO_CATCH_A_RACE; dispute += 1) {
      await database.prepareEmptyDatabase();
      const maria = await database.addUser('Maria');
      const funnel = await database.addPipeline(maria, ['Novo lead']);
      const stageId = funnel.stageIdByName['Novo lead']!;
      for (let cardIndex = 0; cardIndex < CARDS_ALREADY_IN_FUNNEL; cardIndex += 1) {
        const leadId = await database.addLead({ name: `Lead ${cardIndex}`, phone: `+551190000${String(cardIndex).padStart(4, '0')}` });
        await database.addCard(funnel.pipelineId, stageId, leadId, CARD_POSITION_GAP * (cardIndex + 1));
      }
      const leadArriving = await database.addLead({ name: 'Chegando', phone: '+5511999999999' });

      const [deletion, addition] = await Promise.allSettled([
        pipelines.deletePipeline(funnel.pipelineId),
        cards.addCardOnTop({ pipelineId: funnel.pipelineId, stageId, leadId: leadArriving, addedById: maria, expectedStageKind: { isWon: false, isLost: false } }),
      ]);

      if (deletion.status === 'rejected') unexpectedFailures.push(`exclusão: ${String(deletion.reason)}`);
      if (addition.status === 'rejected' && !(addition.reason instanceof NotFoundError)) {
        unexpectedFailures.push(`cartão: ${String(addition.reason)}`);
      }
    }

    expect(unexpectedFailures).toEqual([]);
  }, SLOW_DISPUTE_TIMEOUT_MS);

  it('a importação que mirava o funil continua no histórico, só sem destino', async () => {
    const maria = await database.addUser('Maria');
    const importId = await database.addLeadImport({ requestedById: maria, status: 'PROCESSING', intoTestFunnel: true });

    await pipelines.deletePipeline(database.funnel.pipelineId);

    expect(await database.findLeadImport(importId)).toMatchObject({ pipelineId: null, stageId: null });
  });
});

describe('Funil de cada usuário', () => {
  it('quem é cadastrado já ganha um funil com as 5 etapas padrão', async () => {
    const joao = await users.createUser({ name: 'João', email: 'joao@teste.local', passwordHash: 'x', role: 'AGENT' });

    const [funnelOfJoao] = await database.findPipelinesOwnedBy(joao.id);

    expect(funnelOfJoao?.name).toBe('Funil de João');
    expect(funnelOfJoao?.stages.map((stage) => stage.name)).toEqual(['Novo lead', 'Em atendimento', 'Proposta', 'Ganho', 'Perdido']);
  });

  it('ao excluir alguém, os funis dele passam para o admin que excluiu, com os cartões', async () => {
    const ana = await database.addUser('Ana', { role: 'ADMIN' });
    const joao = await database.addUser('João');
    const funnelOfJoao = await database.addPipeline(joao, ['Novo lead']);
    await database.addCard(funnelOfJoao.pipelineId, funnelOfJoao.stageIdByName['Novo lead']!, await database.addLead({ name: 'Cliente do João', phone: '+5511900000001' }), 1024);

    await users.deleteUserKeepingAnActiveAdmin(joao, ana, new Date());

    const funnelsOfAna = await database.findPipelinesOwnedBy(ana);
    expect(funnelsOfAna.map((pipeline) => pipeline.id)).toContain(funnelOfJoao.pipelineId);
    expect(await database.findLeadNamesInStageOrder(funnelOfJoao.stageIdByName['Novo lead']!)).toEqual(['Cliente do João']);
  });
});
