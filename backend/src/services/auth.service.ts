import { UnauthorizedError } from '@/errors/app-errors';
import { AUTH_ERRORS } from '@/errors/errors.constants';
import type { AuthUser, LoginInput, LoginResult, SessionOutput } from '@/models/auth.model';
import type { RequestContext } from '@/models/common.model';
import { toProfileOutput, type UserCredentials } from '@/models/user.model';
import type { IUserRepository } from '@/repositories/user.repository';
import type { IAuditService } from './audit.service';
import type { IPasswordHasher } from './password-hasher.service';
import type { ISessionService } from './session.service';

export interface IAuthService {
  loginUser(input: LoginInput, ctx: RequestContext): Promise<LoginResult>;
  logoutUser(authUser: AuthUser, ctx: RequestContext): Promise<void>;
  getLoggedUser(authUser: AuthUser): Promise<SessionOutput>;
}

export class AuthService implements IAuthService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly hasher: IPasswordHasher,
    private readonly sessions: ISessionService,
    private readonly audit: IAuditService,
  ) {}

  async loginUser(input: LoginInput, ctx: RequestContext): Promise<LoginResult> {
    const user = await this.findUserAllowedToLogin(input, ctx);
    const session = await this.sessions.startSession(user.id, ctx);
    await this.audit.recordAuditLog({ ...ctx, userId: user.id }, { action: 'auth.login', entity: 'User', entityId: user.id });
    return { ...session, user: toProfileOutput(user) };
  }

  async logoutUser(authUser: AuthUser, ctx: RequestContext): Promise<void> {
    await this.sessions.endSession(authUser.sessionId);
    await this.audit.recordAuditLog(ctx, { action: 'auth.logout', entity: 'User', entityId: authUser.id });
  }

  async getLoggedUser(authUser: AuthUser): Promise<SessionOutput> {
    const user = await this.userRepository.findUserById(authUser.id);
    if (!user) throw new UnauthorizedError(AUTH_ERRORS.INVALID_SESSION);
    return { expiresAt: authUser.sessionExpiresAt, user: toProfileOutput(user) };
  }

  private async findUserAllowedToLogin({ email, password }: LoginInput, ctx: RequestContext): Promise<UserCredentials> {
    const user = await this.userRepository.findUserCredentialsByEmail(email);
    const passwordMatches = await this.hasher.passwordMatches(password, user?.passwordHash);

    if (!user || !user.active || !passwordMatches) {
      await this.audit.recordAuditLog(ctx, { action: 'auth.login_failed', entity: 'User', details: { email } });
      throw new UnauthorizedError(AUTH_ERRORS.INVALID_CREDENTIALS);
    }
    return user;
  }
}
