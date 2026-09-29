import { UnauthorizedError } from '@/errors/app-errors';
import { AUTH_ERRORS } from '@/errors/errors.constants';
import type { AuthUser, LoginInput, LoginResult, SessionOutput } from '@/models/auth.model';
import type { RequestOrigin } from '@/models/common.model';
import { toProfileOutput, type UserCredentials } from '@/models/user.model';
import type { IUserRepository } from '@/repositories/user.repository';
import type { IAuditService } from './audit.service';
import type { IPasswordHasher } from '@/lib/password-hasher';
import type { ISessionService } from './session.service';

export interface IAuthService {
  loginUser(loginCredentials: LoginInput, requestOrigin: RequestOrigin): Promise<LoginResult>;
  logoutUser(loggedUser: AuthUser, requestOrigin: RequestOrigin): Promise<void>;
  getLoggedUser(loggedUser: AuthUser): Promise<SessionOutput>;
}

export class AuthService implements IAuthService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly hasher: IPasswordHasher,
    private readonly sessions: ISessionService,
    private readonly audit: IAuditService,
  ) {}

  async loginUser(loginCredentials: LoginInput, requestOrigin: RequestOrigin): Promise<LoginResult> {
    const user = await this.findUserAllowedToLogin(loginCredentials, requestOrigin);
    const session = await this.sessions.startSession(user.id, requestOrigin);
    await this.audit.recordAuditLog({ ...requestOrigin, userId: user.id }, { action: 'auth.login', entity: 'User', entityId: user.id });
    return { ...session, user: toProfileOutput(user) };
  }

  async logoutUser(loggedUser: AuthUser, requestOrigin: RequestOrigin): Promise<void> {
    await this.sessions.endSession(loggedUser.sessionId);
    await this.audit.recordAuditLog(requestOrigin, { action: 'auth.logout', entity: 'User', entityId: loggedUser.id });
  }

  async getLoggedUser(loggedUser: AuthUser): Promise<SessionOutput> {
    const user = await this.userRepository.findUserById(loggedUser.id);
    if (!user) throw new UnauthorizedError(AUTH_ERRORS.INVALID_SESSION);
    return { expiresAt: loggedUser.sessionExpiresAt, user: toProfileOutput(user) };
  }

  private async findUserAllowedToLogin({ email, password }: LoginInput, requestOrigin: RequestOrigin): Promise<UserCredentials> {
    const user = await this.userRepository.findUserCredentialsByEmail(email);
    const passwordMatches = await this.hasher.passwordMatches(password, user?.passwordHash);

    if (!user || !user.active || !passwordMatches) {
      await this.audit.recordAuditLog(requestOrigin, { action: 'auth.login_failed', entity: 'User', details: { email } });
      throw new UnauthorizedError(AUTH_ERRORS.INVALID_CREDENTIALS);
    }
    return user;
  }
}
