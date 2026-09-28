import type { Request } from 'express';
import { UnauthorizedError } from '@/errors/app-errors';
import { AUTH_ERRORS } from '@/errors/errors.constants';
import type { AuthUser } from '@/models/auth.model';
import type { AuthenticatedContext, RequestContext } from '@/models/common.model';

export interface RequestContextExtractor {
  extractContext(req: Request): RequestContext;
  extractAuthenticatedContext(req: Request): AuthenticatedContext;
  extractAuthUser(req: Request): AuthUser;
}

export class ExpressRequestContextExtractor implements RequestContextExtractor {
  extractContext(req: Request): RequestContext {
    return { userId: req.user?.id, ip: req.ip, userAgent: req.get('user-agent') };
  }

  extractAuthenticatedContext(req: Request): AuthenticatedContext {
    const actor = this.extractAuthUser(req);
    return { ...this.extractContext(req), userId: actor.id, actor };
  }

  extractAuthUser(req: Request): AuthUser {
    if (!req.user) throw new UnauthorizedError(AUTH_ERRORS.INVALID_SESSION);
    return req.user;
  }
}
