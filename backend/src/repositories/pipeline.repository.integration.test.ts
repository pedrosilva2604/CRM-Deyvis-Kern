import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { TestDatabase } from '@/testing/integration/test-database';
import { PipelineRepository } from './pipeline.repository';
import { UserRepository } from './user.repository';

const database = new TestDatabase();
const pipelines = new PipelineRepository(database.client);
const users = new UserRepository(database.client);

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

    await pipelines.deleteStageMovingCards(newStage, proposalStage);

    expect(await database.findLeadNamesInStageOrder(proposalStage)).toEqual(['Já estava', 'Primeiro', 'Segundo']);
  });
});

describe('Excluir um funil', () => {
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
