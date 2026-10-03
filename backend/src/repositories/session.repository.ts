import type { CreateSessionInput, SessionRecord } from '@/models/session.model';
import type { DatabaseClient } from '@/repositories/database-client';

export interface ISessionRepository {
  createSessionIfCredentialsUnchanged(newSession: CreateSessionInput): Promise<{ id: string } | null>;
  findSessionById(id: string): Promise<SessionRecord | null>;
  revokeSession(id: string): Promise<void>;
}

interface UserLoginState {
  passwordHash: string;
  active: boolean;
  deletedAt: Date | null;
}

export class PrismaSessionRepository implements ISessionRepository {
  constructor(private readonly db: DatabaseClient) {}

  async createSessionIfCredentialsUnchanged({ verifiedPasswordHash, ...newSession }: CreateSessionInput): Promise<{ id: string } | null> {
    return await this.db.$transaction(async (transaction) => {
      const [userLoginState] = await transaction.$queryRaw<UserLoginState[]>`
        SELECT "passwordHash", "active", "deletedAt" FROM "User" WHERE "id" = ${newSession.userId}::uuid FOR SHARE`;
      const canStillLogIn =
        userLoginState !== undefined &&
        userLoginState.passwordHash === verifiedPasswordHash &&
        userLoginState.active &&
        userLoginState.deletedAt === null;
      if (!canStillLogIn) return null;
      return await transaction.session.create({ data: newSession, select: { id: true } });
    });
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
}