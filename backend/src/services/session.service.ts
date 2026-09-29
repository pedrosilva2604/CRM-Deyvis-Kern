import { UnauthorizedError } from '@/errors/app-errors';
import type { Clock } from '@/lib/clock';
import { AUTH_ERRORS } from '@/errors/errors.constants';
import type { AuthUser } from '@/models/auth.model';
import type { RequestOrigin } from '@/models/common.model';
import type { IssuedSession, SessionRecord } from '@/models/session.model';
import type { ISessionRepository } from '@/repositories/session.repository';
import type { ITokenService } from './token.service';

const HOUR_MS = 60 * 60 * 1000;

export interface ISessionService {
  startSession(userId: string, requestOrigin: RequestOrigin): Promise<IssuedSession>;
  validateSession(token: string): Promise<AuthUser>;
  endSession(sessionId: string): Promise<void>;
  endAllUserSessions(userId: string): Promise<void>;
}

export class SessionService implements ISessionService {
  constructor(
    private readonly sessions: ISessionRepository,
    private readonly tokens: ITokenService,
    private readonly clock: Clock,
    private readonly ttlHours: number,
  ) {}

  async startSession(userId: string, requestOrigin: RequestOrigin): Promise<IssuedSession> {
    const expiresAt = this.calculateSessionExpiration();
    const session = await this.sessions.createSession({ userId, expiresAt, ip: requestOrigin.ip, userAgent: requestOrigin.userAgent });
    const token = this.tokens.signSessionToken({ sid: session.id }, expiresAt);
    return { token, expiresAt };
  }

  async validateSession(token: string): Promise<AuthUser> {
    const { sid } = this.tokens.verifySessionToken(token);
    const session = await this.sessions.findSessionById(sid);
    this.assertSessionIsUsable(session);
    return { id: session.userId, role: session.user.role, sessionId: session.id, sessionExpiresAt: session.expiresAt };
  }

  async endSession(sessionId: string): Promise<void> {
    await this.sessions.revokeSession(sessionId);
  }

  async endAllUserSessions(userId: string): Promise<void> {
    await this.sessions.revokeAllUserSessions(userId);
  }

  private calculateSessionExpiration() {
    return new Date(this.clock.now().getTime() + this.ttlHours * HOUR_MS);
  }

  private assertSessionIsUsable(session: SessionRecord | null): asserts session is SessionRecord {
    if (!session || this.isSessionRevoked(session) || this.isSessionExpired(session) || !session.user.active) {
      throw new UnauthorizedError(AUTH_ERRORS.INVALID_SESSION);
    }
  }

  private isSessionRevoked(session: SessionRecord) {
    return session.revokedAt !== null;
  }

  private isSessionExpired(session: SessionRecord) {
    return session.expiresAt.getTime() <= this.clock.now().getTime();
  }
}
