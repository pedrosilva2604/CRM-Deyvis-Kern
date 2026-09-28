import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '@/errors/app-errors';
import type { SessionCookie } from '@/lib/session-cookie';
import { AUTH_ERRORS } from '@/errors/errors.constants';
import type { ISessionService } from '@/services/session.service';

export class AuthMiddleware {
  constructor(
    private readonly sessions: ISessionService,
    private readonly sessionCookie: SessionCookie,
  ) {}

  authenticate = async (req: Request, _res: Response, next: NextFunction) => {
    req.user = await this.sessions.validateSession(this.extractSessionToken(req));
    next();
  };

  requireRole =
    (...roles: Role[]) =>
    (req: Request, _res: Response, next: NextFunction) => {
      if (!req.user || !roles.includes(req.user.role)) throw new ForbiddenError(AUTH_ERRORS.ACCESS_DENIED);
      next();
    };

  private extractSessionToken(req: Request) {
    const token = this.sessionCookie.readSessionToken(req.headers.cookie);
    if (!token) throw new UnauthorizedError(AUTH_ERRORS.INVALID_SESSION);
    return token;
  }
}
