import { Role } from '@prisma/client';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '@/errors/app-errors';
import { AUTH_ERRORS, USER_ERRORS } from '@/errors/errors.constants';
import type { AuditLogInput } from '@/models/audit.model';
import type { AuthenticatedContext } from '@/models/common.model';
import type {
  DeleteUserRequest,
  RegisteredUserOutput,
  RegisterUserInput,
  UpdateUserInput,
  UpdateUserPasswordRequest,
  UpdateUserRequest,
  UpdateUserStatusRequest,
} from '@/models/user.model';
import type { IUserRepository } from '@/repositories/user.repository';
import type { IAuditService } from './audit.service';
import type { IPasswordHasher } from './password-hasher.service';
import type { ISessionService } from './session.service';

export interface IUserService {
  registerUser(input: RegisterUserInput, ctx: AuthenticatedContext): Promise<RegisteredUserOutput>;
  listUsers(ctx: AuthenticatedContext): Promise<RegisteredUserOutput[]>;
  updateUser(request: UpdateUserRequest, ctx: AuthenticatedContext): Promise<RegisteredUserOutput>;
  updateUserStatus(request: UpdateUserStatusRequest, ctx: AuthenticatedContext): Promise<RegisteredUserOutput>;
  updateUserPassword(request: UpdateUserPasswordRequest, ctx: AuthenticatedContext): Promise<void>;
  deleteUser(request: DeleteUserRequest, ctx: AuthenticatedContext): Promise<void>;
}

export interface IUserPasswordUpdater {
  replaceUserPassword(userId: string, password: string): Promise<void>;
}

export class UserService implements IUserService, IUserPasswordUpdater {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly hasher: IPasswordHasher,
    private readonly sessions: ISessionService,
    private readonly audit: IAuditService,
  ) {}

  async registerUser(input: RegisterUserInput, ctx: AuthenticatedContext): Promise<RegisteredUserOutput> {
    this.assertActorIsAdmin(ctx);
    await this.assertEmailIsAvailable(input.email);

    const user = await this.createUser(input);
    await this.recordUserAuditLog(ctx, 'user.create', user.id, { name: user.name, email: user.email, role: user.role });
    return user;
  }

  async listUsers(ctx: AuthenticatedContext): Promise<RegisteredUserOutput[]> {
    this.assertActorIsAdmin(ctx);
    return await this.userRepository.findAllUsers();
  }

  async updateUser(
    { targetUserId, data }: UpdateUserRequest,
    ctx: AuthenticatedContext,
  ): Promise<RegisteredUserOutput> {
    this.assertActorIsAdmin(ctx);
    const targetUser = await this.findExistingUserOrFail(targetUserId);
    if (this.isChangingEmail(targetUser, data)) await this.assertEmailIsAvailable(data.email);
    if (this.isLosingAdminRole(targetUser, data)) await this.assertCanRemoveAdmin(targetUser, ctx);

    const updated = await this.userRepository.updateUser(targetUserId, data);
    await this.recordUserAuditLog(ctx, 'user.update', targetUserId, { ...data });
    return updated;
  }

  async updateUserStatus(
    { targetUserId, data }: UpdateUserStatusRequest,
    ctx: AuthenticatedContext,
  ): Promise<RegisteredUserOutput> {
    this.assertActorIsAdmin(ctx);
    const targetUser = await this.findExistingUserOrFail(targetUserId);
    if (!data.active) await this.assertCanRemoveAdmin(targetUser, ctx);

    const updated = await this.userRepository.updateUserStatus(targetUserId, data.active);
    if (!data.active) await this.sessions.endAllUserSessions(targetUserId);
    await this.recordUserAuditLog(ctx, 'user.status_update', targetUserId, { active: data.active });
    return updated;
  }

  async updateUserPassword(
    { targetUserId, data }: UpdateUserPasswordRequest,
    ctx: AuthenticatedContext,
  ): Promise<void> {
    this.assertActorIsAdmin(ctx);
    await this.findExistingUserOrFail(targetUserId);

    await this.replaceUserPassword(targetUserId, data.password);
    await this.recordUserAuditLog(ctx, 'user.password_update', targetUserId, undefined);
  }

  async replaceUserPassword(userId: string, password: string): Promise<void> {
    await this.userRepository.updateUserPassword(userId, await this.hasher.hashPassword(password));
    await this.sessions.endAllUserSessions(userId);
  }

  async deleteUser({ targetUserId }: DeleteUserRequest, ctx: AuthenticatedContext): Promise<void> {
    this.assertActorIsAdmin(ctx);
    const targetUser = await this.findExistingUserOrFail(targetUserId);
    await this.assertCanRemoveAdmin(targetUser, ctx);

    await this.userRepository.deleteUser(targetUserId);
    await this.recordUserAuditLog(ctx, 'user.delete', targetUserId, {
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
    });
  }

  private assertActorIsAdmin({ actor }: AuthenticatedContext): void {
    if (actor.role !== Role.ADMIN) throw new ForbiddenError(AUTH_ERRORS.ACCESS_DENIED);
  }

  private async createUser({ name, email, password, role }: RegisterUserInput): Promise<RegisteredUserOutput> {
    const passwordHash = await this.hasher.hashPassword(password);
    return await this.userRepository.createUser({ name, email, passwordHash, role });
  }

  private async findExistingUserOrFail(targetUserId: string): Promise<RegisteredUserOutput> {
    const targetUser = await this.userRepository.findUserById(targetUserId);
    if (!targetUser) throw new NotFoundError(USER_ERRORS.NOT_FOUND);
    return targetUser;
  }

  private async assertEmailIsAvailable(email: string): Promise<void> {
    const existing = await this.userRepository.findUserByEmail(email);
    if (existing) throw new ConflictError(USER_ERRORS.EMAIL_IN_USE);
  }

  private async assertCanRemoveAdmin(targetUser: RegisteredUserOutput, { actor }: AuthenticatedContext): Promise<void> {
    if (targetUser.id === actor.id) throw new BadRequestError(USER_ERRORS.SELF_ACTION);
    if (await this.isLastActiveAdmin(targetUser)) throw new BadRequestError(USER_ERRORS.LAST_ADMIN);
  }

  private async isLastActiveAdmin(targetUser: RegisteredUserOutput): Promise<boolean> {
    if (targetUser.role !== Role.ADMIN || !targetUser.active) return false;
    return (await this.userRepository.countActiveAdmins()) <= 1;
  }

  private isChangingEmail(
    targetUser: RegisteredUserOutput,
    data: UpdateUserInput,
  ): data is UpdateUserInput & { email: string } {
    return data.email !== undefined && data.email !== targetUser.email;
  }

  private isLosingAdminRole(targetUser: RegisteredUserOutput, data: UpdateUserInput): boolean {
    return targetUser.role === Role.ADMIN && data.role !== undefined && data.role !== Role.ADMIN;
  }

  private async recordUserAuditLog(
    ctx: AuthenticatedContext,
    action: string,
    targetUserId: string,
    details: AuditLogInput['details'],
  ): Promise<void> {
    await this.audit.recordAuditLog(ctx, { action, entity: 'User', entityId: targetUserId, details });
  }
}
