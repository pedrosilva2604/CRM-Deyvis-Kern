import type { Role } from '@prisma/client';

export interface CreateSessionInput {
  userId: string;
  verifiedPasswordHash: string;
  expiresAt: Date;
  ip?: string;
  userAgent?: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  user: { active: boolean; role: Role };
}

export interface IssuedSession {
  token: string;
  expiresAt: Date;
}
