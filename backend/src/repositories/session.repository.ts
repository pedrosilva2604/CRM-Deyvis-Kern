import type { CreateSessionInput, SessionRecord } from '@/models/session.model';
import type { DatabaseClient } from '@/repositories/database-client';

export interface ISessionRepository {
  createSession(newSession: CreateSessionInput): Promise<{ id: string }>;
  findSessionById(id: string): Promise<SessionRecord | null>;
  revokeSession(id: string): Promise<void>;
  revokeAllUserSessions(userId: string): Promise<void>;
}

export class PrismaSessionRepository implements ISessionRepository {
  constructor(private readonly db: DatabaseClient) {}

  async createSession(newSession: CreateSessionInput): Promise<{ id: string }> {
    return await this.db.session.create({ data: newSession, select: { id: true } });
  }

  async findSessionById(id: string): Promise<SessionRecord | null> {
    return await this.db.session.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        revokedAt: true,
        user: { select: { active: true, role: true } },
      },
    });
  }

  async revokeSession(id: string): Promise<void> {
    await this.db.session.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.db.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }
}
