import type { AuthUser } from './auth.model';

export interface RequestContext {
  userId?: string;
  ip?: string;
  userAgent?: string;
}

export interface AuthenticatedContext extends RequestContext {
  userId: string;
  actor: AuthUser;
}

export interface MessageOutput {
  message: string;
}
