import type { Request } from 'express';
import { UnauthorizedError } from '@/errors/app-errors';
import { AUTH_ERRORS } from '@/errors/errors.constants';
import type { AuthUser } from '@/models/auth.model';
import type { LoggedUserContext, RequestOrigin } from '@/models/common.model';

export interface RequestContextExtractor {
  extractRequestOrigin(req: Request): RequestOrigin;
  extractLoggedUserContext(req: Request): LoggedUserContext;
  extractLoggedUser(req: Request): AuthUser;
}

export class ExpressRequestContextExtractor implements RequestContextExtractor {
  extractRequestOrigin(req: Request): RequestOrigin {
    return { userId: req.user?.id, ip: req.ip, userAgent: req.get('user-agent') };
  }

  extractLoggedUserContext(req: Request): LoggedUserContext {
    const loggedUser = this.extractLoggedUser(req);
    return { ...this.extractRequestOrigin(req), userId: loggedUser.id, loggedUser };
  }

  extractLoggedUser(req: Request): AuthUser {
    if (!req.user) throw new UnauthorizedError(AUTH_ERRORS.INVALID_SESSION);
    return req.user;
  }
}
