import { createHash, randomBytes } from 'node:crypto';
import { BadRequestError } from '@/errors/app-errors';
import { PASSWORD_RESET_ERRORS } from '@/errors/errors.constants';
import type { Clock } from '@/lib/clock';
import type { ForgotPasswordInput, ResetPasswordInput } from '@/models/auth.model';
import type { RequestContext } from '@/models/common.model';
import type { PasswordResetTokenRecord } from '@/models/password-reset.model';
import type { IPasswordResetTokenRepository } from '@/repositories/password-reset-token.repository';
import type { IUserRepository } from '@/repositories/user.repository';
import type { IAuditService } from './audit.service';
import type { IMailService, Recipient } from './mail.service';
import type { IUserPasswordUpdater } from './user.service';

const MINUTE_MS = 60 * 1000;

export interface PasswordResetConfig {
  appUrl: string;
  tokenTtlMinutes: number;
}

export interface IPasswordResetService {
  requestPasswordReset(input: ForgotPasswordInput, ctx: RequestContext): Promise<void>;
  resetPassword(input: ResetPasswordInput, ctx: RequestContext): Promise<void>;
}

export class PasswordResetService implements IPasswordResetService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly resetTokens: IPasswordResetTokenRepository,
    private readonly passwordUpdater: IUserPasswordUpdater,
    private readonly mail: IMailService,
    private readonly audit: IAuditService,
    private readonly clock: Clock,
    private readonly config: PasswordResetConfig,
  ) {}

  async requestPasswordReset({ email }: ForgotPasswordInput, ctx: RequestContext): Promise<void> {
    const user = await this.userRepository.findUserByEmail(email);
    if (!user?.active) return;

    const token = this.generateResetToken();
    await this.resetTokens.replaceUserResetToken(user.id, this.hashResetToken(token), this.calculateResetTokenExpiration());
    await this.audit.recordAuditLog({ ...ctx, userId: user.id }, { action: 'auth.password_reset_requested', entity: 'User', entityId: user.id });
    void this.sendResetLink(user, token);
  }

  async resetPassword({ token, password }: ResetPasswordInput, ctx: RequestContext): Promise<void> {
    const record = await this.findUsableResetToken(token);
    await this.consumeResetToken(record);
    await this.passwordUpdater.replaceUserPassword(record.userId, password);
    await this.audit.recordAuditLog({ ...ctx, userId: record.userId }, { action: 'auth.password_reset', entity: 'User', entityId: record.userId });
  }

  private async findUsableResetToken(token: string): Promise<PasswordResetTokenRecord> {
    const record = await this.resetTokens.findResetTokenByHash(this.hashResetToken(token));
    if (!record || !this.isResetTokenUsable(record)) throw new BadRequestError(PASSWORD_RESET_ERRORS.INVALID_LINK);
    return record;
  }

  private isResetTokenUsable(record: PasswordResetTokenRecord) {
    return record.usedAt === null && !this.isResetTokenExpired(record) && record.user.active;
  }

  private isResetTokenExpired(record: PasswordResetTokenRecord) {
    return record.expiresAt.getTime() <= this.clock.now().getTime();
  }

  private async consumeResetToken(record: PasswordResetTokenRecord): Promise<void> {
    const consumed = await this.resetTokens.markResetTokenAsUsed(record.id);
    if (!consumed) throw new BadRequestError(PASSWORD_RESET_ERRORS.INVALID_LINK);
  }

  private async sendResetLink(user: Recipient, token: string): Promise<void> {
    try {
      await this.mail.sendPasswordResetEmail(user, this.buildResetLink(token), this.config.tokenTtlMinutes);
    } catch (err) {
      console.error('[mail] falha ao enviar e-mail de redefinição:', err instanceof Error ? err.message : err);
    }
  }

  private buildResetLink(token: string) {
    return `${this.config.appUrl}/redefinir-senha#token=${token}`;
  }

  private generateResetToken() {
    return randomBytes(32).toString('base64url');
  }

  private hashResetToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private calculateResetTokenExpiration() {
    return new Date(this.clock.now().getTime() + this.config.tokenTtlMinutes * MINUTE_MS);
  }
}
