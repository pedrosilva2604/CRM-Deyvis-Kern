import { Role, type PrismaClient, type Theme } from '@prisma/client';
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

export interface IUserRepository {
  createUser(data: CreateUserData): Promise<RegisteredUserOutput>;
  findAllUsers(): Promise<RegisteredUserOutput[]>;
  findUserById(id: string): Promise<RegisteredUserOutput | null>;
  findUserByEmail(email: string): Promise<RegisteredUserOutput | null>;
  findUserCredentialsByEmail(email: string): Promise<UserCredentials | null>;
  countActiveAdmins(): Promise<number>;
  findActiveUsersForAssignment(): Promise<LeadPersonOutput[]>;
  isActiveUser(id: string): Promise<boolean>;
  updateUser(id: string, data: UpdateUserData): Promise<RegisteredUserOutput>;
  updateUserTheme(id: string, theme: Theme): Promise<UserOutput>;
  activateUser(id: string): Promise<RegisteredUserOutput>;
  deactivateUser(id: string): Promise<RegisteredUserOutput>;
  updateUserPassword(id: string, passwordHash: string): Promise<void>;
  deleteUser(id: string): Promise<void>;
}

export class UserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createUser(data: CreateUserData): Promise<RegisteredUserOutput> {
    const user = await this.prisma.user.create({ data });
    return toRegisteredUserOutput(user);
  }

  async findAllUsers(): Promise<RegisteredUserOutput[]> {
    const users = await this.prisma.user.findMany({ orderBy: { name: 'asc' } });
    return users.map(toRegisteredUserOutput);
  }

  async findUserById(id: string): Promise<RegisteredUserOutput | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? toRegisteredUserOutput(user) : null;
  }

  async findUserByEmail(email: string): Promise<RegisteredUserOutput | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user ? toRegisteredUserOutput(user) : null;
  }

  async findUserCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user ? toUserCredentials(user) : null;
  }

  async countActiveAdmins(): Promise<number> {
    return await this.prisma.user.count({ where: { role: Role.ADMIN, active: true } });
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

  async updateUser(id: string, data: UpdateUserData): Promise<RegisteredUserOutput> {
    const user = await this.prisma.user.update({ where: { id }, data });
    return toRegisteredUserOutput(user);
  }

  async updateUserTheme(id: string, theme: Theme): Promise<UserOutput> {
    const user = await this.prisma.user.update({ where: { id }, data: { theme } });
    return toUserOutput(user);
  }

  async activateUser(id: string): Promise<RegisteredUserOutput> {
    const user = await this.prisma.user.update({ where: { id }, data: { active: true } });
    return toRegisteredUserOutput(user);
  }

  async deactivateUser(id: string): Promise<RegisteredUserOutput> {
    const user = await this.prisma.user.update({ where: { id }, data: { active: false } });
    return toRegisteredUserOutput(user);
  }

  async updateUserPassword(id: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  async deleteUser(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }
}
