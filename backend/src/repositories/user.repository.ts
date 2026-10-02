import { Role, type Theme } from '@prisma/client';
import { DEFAULT_PIPELINE_STAGES, defaultPipelineNameFor } from '@/constants/default-pipeline';
import type { LeadPersonOutput } from '@/models/lead.model';
import {
  toRegisteredUserOutput,
  toUserCredentials,
  toUserOutput,
  type CreateUserData,
  type RegisteredUserOutput,
  type UpdateUserData,
  type UserCredentials,
  type UserOutput,
} from '@/models/user.model';
import type { DatabaseClient, DatabaseTransaction } from '@/repositories/database-client';

export interface IUserRepository {
  createUser(data: CreateUserData): Promise<RegisteredUserOutput>;
  findAllUsers(): Promise<RegisteredUserOutput[]>;
  findUserById(id: string): Promise<RegisteredUserOutput | null>;
  findUserByEmail(email: string): Promise<RegisteredUserOutput | null>;
  findUserCredentialsByEmail(email: string): Promise<UserCredentials | null>;
  findActiveUsersForAssignment(): Promise<LeadPersonOutput[]>;
  isActiveUser(id: string): Promise<boolean>;
  updateUserKeepingAnActiveAdmin(id: string, data: UpdateUserData): Promise<RegisteredUserOutput | null>;
  updateUserTheme(id: string, theme: Theme): Promise<UserOutput>;
  activateUser(id: string): Promise<RegisteredUserOutput>;
  deactivateUserKeepingAnActiveAdmin(id: string): Promise<RegisteredUserOutput | null>;
  deleteUserKeepingAnActiveAdmin(id: string, newPipelineOwnerId: string, deletedAt: Date): Promise<boolean>;
  replaceUserPassword(id: string, passwordHash: string, resetTokenToConsume: string | null): Promise<boolean>;
}

const notDeletedUsers = { deletedAt: null };

function isRemovingAdminRole(data: UpdateUserData): boolean {
  return data.role !== undefined && data.role !== Role.ADMIN;
}

export class UserRepository implements IUserRepository {
  constructor(private readonly prisma: DatabaseClient) {}

  async createUser(data: CreateUserData): Promise<RegisteredUserOutput> {
    const user = await this.prisma.user.create({
      data: {
        ...data,
        ownedPipelines: { create: { name: defaultPipelineNameFor(data.name), stages: { create: DEFAULT_PIPELINE_STAGES } } },
      },
    });
    return toRegisteredUserOutput(user);
  }

  async findAllUsers(): Promise<RegisteredUserOutput[]> {
    const users = await this.prisma.user.findMany({ where: notDeletedUsers, orderBy: { name: 'asc' } });
    return users.map(toRegisteredUserOutput);
  }

  async findUserById(id: string): Promise<RegisteredUserOutput | null> {
    const user = await this.prisma.user.findFirst({ where: { id, ...notDeletedUsers } });
    return user ? toRegisteredUserOutput(user) : null;
  }

  async findUserByEmail(email: string): Promise<RegisteredUserOutput | null> {
    const user = await this.prisma.user.findFirst({ where: { email, ...notDeletedUsers } });
    return user ? toRegisteredUserOutput(user) : null;
  }

  async findUserCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    const user = await this.prisma.user.findFirst({ where: { email, ...notDeletedUsers } });
    return user ? toUserCredentials(user) : null;
  }

  async findActiveUsersForAssignment(): Promise<LeadPersonOutput[]> {
    return await this.prisma.user.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }

  async isActiveUser(id: string): Promise<boolean> {
    return (await this.prisma.user.count({ where: { id, active: true } })) > 0;
  }

  async updateUserKeepingAnActiveAdmin(id: string, data: UpdateUserData): Promise<RegisteredUserOutput | null> {
    return await this.prisma.$transaction(async (transaction) => {
      if (isRemovingAdminRole(data) && (await this.wouldLeaveNoActiveAdmin(transaction, id))) return null;
      const user = await transaction.user.update({ where: { id }, data });
      return toRegisteredUserOutput(user);
    });
  }

  async updateUserTheme(id: string, theme: Theme): Promise<UserOutput> {
    const user = await this.prisma.user.update({ where: { id }, data: { theme } });
    return toUserOutput(user);
  }

  async activateUser(id: string): Promise<RegisteredUserOutput> {
    const user = await this.prisma.user.update({ where: { id }, data: { active: true } });
    return toRegisteredUserOutput(user);
  }

  async deactivateUserKeepingAnActiveAdmin(id: string): Promise<RegisteredUserOutput | null> {
    return await this.prisma.$transaction(async (transaction) => {
      if (await this.wouldLeaveNoActiveAdmin(transaction, id)) return null;
      const user = await transaction.user.update({ where: { id }, data: { active: false } });
      await this.revokeAllSessionsOf(transaction, id);
      return toRegisteredUserOutput(user);
    });
  }

  async deleteUserKeepingAnActiveAdmin(id: string, newPipelineOwnerId: string, deletedAt: Date): Promise<boolean> {
    return await this.prisma.$transaction(async (transaction) => {
      if (await this.wouldLeaveNoActiveAdmin(transaction, id)) return false;
      await transaction.pipeline.updateMany({ where: { ownerId: id }, data: { ownerId: newPipelineOwnerId } });
      await transaction.pipelineMember.deleteMany({ where: { userId: id } });
      await transaction.lead.updateMany({ where: { assignedToId: id }, data: { assignedToId: null } });
      await transaction.user.update({ where: { id }, data: { active: false, deletedAt } });
      await this.revokeAllSessionsOf(transaction, id);
      return true;
    });
  }

  async replaceUserPassword(id: string, passwordHash: string, resetTokenToConsume: string | null): Promise<boolean> {
    return await this.prisma.$transaction(async (transaction) => {
      if (resetTokenToConsume !== null) {
        const consumedResetToken = await transaction.passwordResetToken.updateMany({
          where: { id: resetTokenToConsume, userId: id, usedAt: null },
          data: { usedAt: new Date() },
        });
        if (consumedResetToken.count === 0) return false;
      }
      await transaction.user.update({ where: { id }, data: { passwordHash } });
      await this.revokeAllSessionsOf(transaction, id);
      return true;
    });
  }

  private async wouldLeaveNoActiveAdmin(transaction: DatabaseTransaction, userId: string): Promise<boolean> {
    const lockedActiveAdmins = await transaction.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "User" WHERE "role" = 'ADMIN' AND "active" = true FOR UPDATE`;
    const isTargetAnActiveAdmin = lockedActiveAdmins.some((activeAdmin) => activeAdmin.id === userId);
    return isTargetAnActiveAdmin && lockedActiveAdmins.length <= 1;
  }

  private async revokeAllSessionsOf(transaction: DatabaseTransaction, userId: string): Promise<void> {
    await transaction.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }
}
