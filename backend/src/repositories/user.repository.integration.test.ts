import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ConflictError } from '@/errors/app-errors';
import { USER_ERRORS } from '@/errors/errors.constants';
import { ORIGINAL_PASSWORD_HASH, TestDatabase } from '@/testing/integration/test-database';
import { UserRepository } from './user.repository';

const database = new TestDatabase();
const users = new UserRepository(database.client);
const NEW_PASSWORD_HASH = 'hash-da-senha-nova';
const HASH_THAT_POSTGRES_REFUSES = 'hash-com-caractere-nulo\u0000';
const DISPUTES_TO_CATCH_A_RACE = 10;

beforeEach(async () => {
  await database.prepareEmptyDatabase();
});

afterAll(async () => {
  await database.disconnect();
});

describe('Sempre sobra um administrador ativo', () => {
  it('quando dois admins se desativam ao mesmo tempo, só um consegue (em 10 disputas seguidas)', async () => {
    for (let dispute = 1; dispute <= DISPUTES_TO_CATCH_A_RACE; dispute += 1) {
      await database.prepareEmptyDatabase();
      const ana = await database.addUser('Ana', { role: 'ADMIN' });
      const bruno = await database.addUser('Bruno', { role: 'ADMIN' });

      await Promise.all([users.deactivateUserKeepingAnActiveAdmin(ana), users.deactivateUserKeepingAnActiveAdmin(bruno)]);

      expect(await database.countActiveAdmins()).toBe(1);
    }
  });

  it('não exclui o último admin ativo', async () => {
    const ana = await database.addUser('Ana', { role: 'ADMIN' });

    expect(await users.deleteUserKeepingAnActiveAdmin(ana, ana, new Date())).toBe(false);
    expect(await database.countActiveAdmins()).toBe(1);
  });

  it('não rebaixa o último admin ativo para vendedor', async () => {
    const ana = await database.addUser('Ana', { role: 'ADMIN' });

    expect(await users.updateUserKeepingAnActiveAdmin(ana, { role: 'AGENT' })).toBeNull();
    expect(await database.findUser(ana)).toMatchObject({ role: 'ADMIN' });
  });

  it('e-mail repetido dentro da transação também vira conflito (409) com a mensagem de e-mail em uso', async () => {
    const ana = await database.addUser('Ana', { role: 'ADMIN' });
    const bruno = await database.addUser('Bruno', { role: 'ADMIN' });
    const emailOfAna = (await database.findUser(ana)).email;

    const update = users.updateUserKeepingAnActiveAdmin(bruno, { email: emailOfAna });

    await expect(update).rejects.toBeInstanceOf(ConflictError);
    await expect(update).rejects.toThrow(USER_ERRORS.EMAIL_IN_USE);
  });

  it('deixa editar o nome do último admin ativo', async () => {
    const ana = await database.addUser('Ana', { role: 'ADMIN' });

    await users.updateUserKeepingAnActiveAdmin(ana, { name: 'Ana Souza' });

    expect(await database.findUser(ana)).toMatchObject({ name: 'Ana Souza', role: 'ADMIN' });
  });

  it('desativa um admin quando sobra outro, encerrando as sessões dele junto', async () => {
    await database.addUser('Ana', { role: 'ADMIN' });
    const bruno = await database.addUser('Bruno', { role: 'ADMIN' });
    await database.addOpenSession(bruno);

    await users.deactivateUserKeepingAnActiveAdmin(bruno);

    expect(await database.findUser(bruno)).toMatchObject({ active: false });
    expect(await database.countOpenSessionsOf(bruno)).toBe(0);
  });
});

describe('Excluir um usuário guarda o histórico', () => {
  it('o usuário continua no banco, sem acesso, e o cartão continua dizendo quem o adicionou', async () => {
    const ana = await database.addUser('Ana', { role: 'ADMIN' });
    const joao = await database.addUser('João');
    const emailOfJoao = (await database.findUser(joao)).email;
    const funnelOfAna = await database.addPipeline(ana, ['Novo lead']);
    await database.addMember(funnelOfAna.pipelineId, joao);
    const leadOfJoao = await database.addLead({ name: 'Cliente', phone: '+5511900000001' });
    const cardAddedByJoao = await database.addCard(funnelOfAna.pipelineId, funnelOfAna.stageIdByName['Novo lead']!, leadOfJoao, 1024, joao);
    await database.addOpenSession(joao);
    const deletedAt = new Date('2026-10-02T15:00:00.000Z');

    expect(await users.deleteUserKeepingAnActiveAdmin(joao, ana, deletedAt)).toBe(true);

    expect(await database.findUser(joao)).toMatchObject({ active: false, deletedAt });
    expect(await database.findCard(cardAddedByJoao)).toMatchObject({ addedById: joao });
    expect(await database.client.pipelineMember.count({ where: { userId: joao } })).toBe(0);
    expect(await database.countOpenSessionsOf(joao)).toBe(0);
    expect((await users.findAllUsers()).map((user) => user.id)).not.toContain(joao);
    expect(await users.findUserById(joao)).toBeNull();
    expect(await users.findUserCredentialsByEmail(emailOfJoao)).toBeNull();
  });

  it('o e-mail de quem foi excluído continua reservado', async () => {
    const ana = await database.addUser('Ana', { role: 'ADMIN' });
    const joao = await database.addUser('João');
    const emailOfJoao = (await database.findUser(joao)).email;
    await users.deleteUserKeepingAnActiveAdmin(joao, ana, new Date());

    const reuse = users.createUser({ name: 'Outro João', email: emailOfJoao, passwordHash: 'x', role: 'AGENT' });

    await expect(reuse).rejects.toBeInstanceOf(ConflictError);
    await expect(reuse).rejects.toThrow(USER_ERRORS.EMAIL_IN_USE);
  });
});

describe('Redefinir senha pelo link: ou tudo, ou nada', () => {
  it('troca a senha, gasta o link e encerra as sessões juntos', async () => {
    const maria = await database.addUser('Maria');
    await database.addOpenSession(maria);
    const resetToken = await database.addResetToken(maria);

    const wasReplaced = await users.replaceUserPassword(maria, NEW_PASSWORD_HASH, resetToken);

    expect(wasReplaced).toBe(true);
    expect(await database.findUser(maria)).toMatchObject({ passwordHash: NEW_PASSWORD_HASH });
    expect(await database.isResetTokenStillUsable(resetToken)).toBe(false);
    expect(await database.countOpenSessionsOf(maria)).toBe(0);
  });

  it('se salvar a senha falhar, nada muda e o link continua valendo', async () => {
    const maria = await database.addUser('Maria');
    await database.addOpenSession(maria);
    const resetToken = await database.addResetToken(maria);

    await expect(users.replaceUserPassword(maria, HASH_THAT_POSTGRES_REFUSES, resetToken)).rejects.toThrow();

    expect(await database.findUser(maria)).toMatchObject({ passwordHash: ORIGINAL_PASSWORD_HASH });
    expect(await database.isResetTokenStillUsable(resetToken)).toBe(true);
    expect(await database.countOpenSessionsOf(maria)).toBe(1);
  });

  it('o mesmo link usado duas vezes ao mesmo tempo troca a senha uma vez só (em 10 disputas seguidas)', async () => {
    for (let dispute = 1; dispute <= DISPUTES_TO_CATCH_A_RACE; dispute += 1) {
      await database.prepareEmptyDatabase();
      const maria = await database.addUser('Maria');
      const resetToken = await database.addResetToken(maria);

      const replacements = await Promise.all([
        users.replaceUserPassword(maria, 'hash-do-primeiro-clique', resetToken),
        users.replaceUserPassword(maria, 'hash-do-segundo-clique', resetToken),
      ]);

      expect(replacements.filter((wasReplaced) => wasReplaced)).toHaveLength(1);
    }
  });

  it('não aceita o link de outra pessoa', async () => {
    const maria = await database.addUser('Maria');
    const joao = await database.addUser('João');
    const resetTokenOfJoao = await database.addResetToken(joao);

    expect(await users.replaceUserPassword(maria, NEW_PASSWORD_HASH, resetTokenOfJoao)).toBe(false);
    expect(await database.findUser(maria)).toMatchObject({ passwordHash: ORIGINAL_PASSWORD_HASH });
  });
});
