import { Role } from '@prisma/client';
import { BadRequestError, ConflictError, DeletedUserHoldsEmailError, ForbiddenError, NotFoundError } from '@/errors/app-errors';
import { AUTH_ERRORS, USER_ERRORS } from '@/errors/errors.constants';
import type { AuditLogInput } from '@/models/audit.model';
import type { LoggedUserContext } from '@/models/common.model';
import type {
  ActivateUserRequest,
  DeactivateUserRequest,
  DeleteUserRequest,
  RegisteredUserOutput,
  RegisterUserInput,
  RestoreUserRequest,
  UpdateUserInput,
  UpdateUserPasswordRequest,
  UpdateUserRequest,
} from '@/models/user.model';
import type { IUserRepository } from '@/repositories/user.repository';
import type { IAuditService } from './audit.service';
import type { Clock } from '@/infra/clock';
import type { IPasswordHasher } from '@/infra/password-hasher';
import type { ISessionService } from './session.service';

export interface IUserService {
  registerUser(newUserRegistration: RegisterUserInput, loggedUserContext: LoggedUserContext): Promise<RegisteredUserOutput>;
  listUsers(loggedUserContext: LoggedUserContext): Promise<RegisteredUserOutput[]>;
  updateUser(request: UpdateUserRequest, loggedUserContext: LoggedUserContext): Promise<RegisteredUserOutput>;
  activateUser(request: ActivateUserRequest, loggedUserContext: LoggedUserContext): Promise<RegisteredUserOutput>;
  deactivateUser(request: DeactivateUserRequest, loggedUserContext: LoggedUserContext): Promise<RegisteredUserOutput>;
  updateUserPassword(request: UpdateUserPasswordRequest, loggedUserContext: LoggedUserContext): Promise<void>;
  deleteUser(request: DeleteUserRequest, loggedUserContext: LoggedUserContext): Promise<void>;
  restoreUser(request: RestoreUserRequest, loggedUserContext: LoggedUserContext): Promise<void>;
}

export interface IUserPasswordUpdater {
  replaceUserPassword(userId: string, password: string, resetTokenToConsume: string | null): Promise<boolean>;
}

export class UserService implements IUserService, IUserPasswordUpdater {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly hasher: IPasswordHasher,
    private readonly sessions: ISessionService,
    private readonly audit: IAuditService,
    private readonly clock: Clock,
  ) {}

  async registerUser(newUserRegistration: RegisterUserInput, loggedUserContext: LoggedUserContext): Promise<RegisteredUserOutput> {
    this.assertLoggedUserIsAdmin(loggedUserContext);
    await this.assertEmailIsAvailable(newUserRegistration.email, USER_ERRORS.EMAIL_OF_DELETED_USER);

    const registeredUser = await this.createUser(newUserRegistration);
    await this.recordUserAuditLog(loggedUserContext, 'user.create', registeredUser.id, {
      name: registeredUser.name,
      email: registeredUser.email,
      role: registeredUser.role,
    });
    return registeredUser;
  }

  async listUsers(loggedUserContext: LoggedUserContext): Promise<RegisteredUserOutput[]> {
    this.assertLoggedUserIsAdmin(loggedUserContext);
    return await this.userRepository.findAllUsers();
  }

  async updateUser(
    { targetUserId, data }: UpdateUserRequest,
    loggedUserContext: LoggedUserContext,
  ): Promise<RegisteredUserOutput> {
    this.assertLoggedUserIsAdmin(loggedUserContext);
    const targetUser = await this.findExistingUserOrFail(targetUserId);
    if (this.isChangingEmail(targetUser, data)) await this.assertEmailIsAvailable(data.email, USER_ERRORS.EMAIL_OF_DELETED_USER_ON_EDIT);
    if (this.isLosingAdminRole(targetUser, data)) this.assertIsNotSelf(targetUser, loggedUserContext);

    const updated = await this.userRepository.updateUserKeepingAnActiveAdmin(targetUserId, data);
    if (!updated) throw new BadRequestError(USER_ERRORS.LAST_ADMIN);
    await this.recordUserAuditLog(loggedUserContext, 'user.update', targetUserId, { ...data });
    return updated;
  }

  async activateUser({ targetUserId }: ActivateUserRequest, loggedUserContext: LoggedUserContext): Promise<RegisteredUserOutput> {
    this.assertLoggedUserIsAdmin(loggedUserContext);
    await this.findExistingUserOrFail(targetUserId);

    const activated = await this.userRepository.activateUser(targetUserId);
    if (!activated) throw new NotFoundError(USER_ERRORS.NOT_FOUND);
    await this.recordUserAuditLog(loggedUserContext, 'user.activate', targetUserId, undefined);
    return activated;
  }

  async deactivateUser(
    { targetUserId }: DeactivateUserRequest,
    loggedUserContext: LoggedUserContext,
  ): Promise<RegisteredUserOutput> {
    this.assertLoggedUserIsAdmin(loggedUserContext);
    const targetUser = await this.findExistingUserOrFail(targetUserId);
    this.assertIsNotSelf(targetUser, loggedUserContext);

    const deactivated = await this.userRepository.deactivateUserKeepingAnActiveAdmin(targetUserId);
    if (!deactivated) throw new BadRequestError(USER_ERRORS.LAST_ADMIN);
    this.sessions.notifyAllUserSessionsEnded(targetUserId);
    await this.recordUserAuditLog(loggedUserContext, 'user.deactivate', targetUserId, undefined);
    return deactivated;
  }

  async updateUserPassword(
    { targetUserId, data }: UpdateUserPasswordRequest,
    loggedUserContext: LoggedUserContext,
  ): Promise<void> {
    this.assertLoggedUserIsAdmin(loggedUserContext);
    await this.findExistingUserOrFail(targetUserId);

    await this.replaceUserPassword(targetUserId, data.password, null);
    await this.recordUserAuditLog(loggedUserContext, 'user.password_update', targetUserId, undefined);
  }

  async replaceUserPassword(userId: string, password: string, resetTokenToConsume: string | null): Promise<boolean> {
    const passwordHash = await this.hasher.hashPassword(password);
    const wasReplaced = await this.userRepository.replaceUserPassword(userId, passwordHash, resetTokenToConsume);
    if (wasReplaced) this.sessions.notifyAllUserSessionsEnded(userId);
    return wasReplaced;
  }

  async deleteUser({ targetUserId }: DeleteUserRequest, loggedUserContext: LoggedUserContext): Promise<void> {
    this.assertLoggedUserIsAdmin(loggedUserContext);
    const targetUser = await this.findExistingUserOrFail(targetUserId);
    this.assertIsNotSelf(targetUser, loggedUserContext);

    const userDeletion = await this.userRepository.deleteUserKeepingAnActiveAdmin(
      targetUserId,
      loggedUserContext.loggedUser.id,
      this.clock.now(),
    );
    if (userDeletion === 'lastAdmin') throw new BadRequestError(USER_ERRORS.LAST_ADMIN);
    if (userDeletion === 'actorNotAdmin') throw new ForbiddenError(AUTH_ERRORS.ACCESS_DENIED);
    this.sessions.notifyAllUserSessionsEnded(targetUserId);
    await this.recordUserAuditLog(loggedUserContext, 'user.delete', targetUserId, {
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
    });
  }

  async restoreUser({ targetUserId, data }: RestoreUserRequest, loggedUserContext: LoggedUserContext): Promise<void> {
    this.assertLoggedUserIsAdmin(loggedUserContext);
    const passwordHash = await this.hasher.hashPassword(data.password);

    const wasRestored = await this.userRepository.restoreDeletedUser(targetUserId, passwordHash);
    if (!wasRestored) throw new NotFoundError(USER_ERRORS.DELETED_USER_NOT_FOUND);
    await this.recordUserAuditLog(loggedUserContext, 'user.restore', targetUserId, undefined);
  }

  private assertLoggedUserIsAdmin({ loggedUser }: LoggedUserContext): void {
    if (loggedUser.role !== Role.ADMIN) throw new ForbiddenError(AUTH_ERRORS.ACCESS_DENIED);
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

  private async assertEmailIsAvailable(email: string, deletedUserMessage: string): Promise<void> {
    const existing = await this.userRepository.findUserByEmail(email);
    if (existing) throw new ConflictError(USER_ERRORS.EMAIL_IN_USE);
    const deletedUserId = await this.userRepository.findDeletedUserIdByEmail(email);
    if (deletedUserId) throw new DeletedUserHoldsEmailError(deletedUserMessage, deletedUserId);
  }

  private assertIsNotSelf(targetUser: RegisteredUserOutput, { loggedUser }: LoggedUserContext): void {
    if (targetUser.id === loggedUser.id) throw new BadRequestError(USER_ERRORS.SELF_ACTION);
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
    loggedUserContext: LoggedUserContext,
    action: string,
    targetUserId: string,
    details: AuditLogInput['details'],
  ): Promise<void> {
    await this.audit.recordAuditLog(loggedUserContext, { action, entity: 'User', entityId: targetUserId, details });
  }
}
