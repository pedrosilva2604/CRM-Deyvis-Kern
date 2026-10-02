import type { Role } from '@prisma/client';
import type { LoggedUserContext } from '@/models/common.model';

function loggedUser(userId: string, role: Role): LoggedUserContext {
  return {
    userId,
    loggedUser: { id: userId, role, sessionId: `sessao-de-${userId}`, sessionExpiresAt: new Date('2099-01-01T00:00:00.000Z') },
  };
}

export function loggedSeller(userId: string): LoggedUserContext {
  return loggedUser(userId, 'AGENT');
}

export function loggedAdmin(userId: string): LoggedUserContext {
  return loggedUser(userId, 'ADMIN');
}
