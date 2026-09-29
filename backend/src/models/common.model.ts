import type { AuthUser } from './auth.model';

export interface RequestOrigin {
  userId?: string;
  ip?: string;
  userAgent?: string;
}

export interface LoggedUserContext extends RequestOrigin {
  userId: string;
  loggedUser: AuthUser;
}

export interface MessageOutput {
  message: string;
}
