import type { PrismaClient } from '@prisma/client';
import type { PasswordResetTokenRecord } from '@/models/password-reset.model';

export interface IPasswordResetTokenRepository {
  replaceUserResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findResetTokenByHash(tokenHash: string): Promise<PasswordResetTokenRecord | null>;
  markResetTokenAsUsed(id: string): Promise<boolean>;
}

export class PrismaPasswordResetTokenRepository implements IPasswordResetTokenRepository {
  constructor(private readonly db: PrismaClient) {}

  async replaceUserResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.db.$transaction([
      this.db.passwordResetToken.deleteMany({ where: { userId, usedAt: null } }),
      this.db.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } }),
    ]);
  }

  async findResetTokenByHash(tokenHash: string): Promise<PasswordResetTokenRecord | null> {
    return await this.db.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true, user: { select: { active: true } } },
    });
  }

  async markResetTokenAsUsed(id: string): Promise<boolean> {
    const { count } = await this.db.passwordResetToken.updateMany({
      where: { id, usedAt: null },
      data: { usedAt: new Date() },
    });
    return count === 1;
  }
}
