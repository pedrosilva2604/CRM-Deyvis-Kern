import type { Request, Response } from 'express';
import { PASSWORD_SUCCESS_MESSAGES } from '@/constants/success-messages';
import { HttpStatus, sendSuccessMessage } from '@/infra/http-status';
import type { RequestContextExtractor } from '@/infra/request-context-extractor';
import type { ForgotPasswordInput, ResetPasswordInput } from '@/models/auth.model';
import type { IPasswordResetService } from '@/services/password-reset.service';

export class PasswordController {
  constructor(
    private readonly passwordResetService: IPasswordResetService,
    private readonly requestContextExtractor: RequestContextExtractor,
  ) {}

  requestPasswordReset = async (req: Request, res: Response) => {
    const forgotPasswordRequest: ForgotPasswordInput = req.body;
    const requestOrigin = this.requestContextExtractor.extractRequestOrigin(req);
    await this.passwordResetService.requestPasswordReset(forgotPasswordRequest, requestOrigin);
    sendSuccessMessage(res, HttpStatus.OK, PASSWORD_SUCCESS_MESSAGES.RESET_LINK_SENT_IF_EMAIL_EXISTS);
  };

  resetPassword = async (req: Request, res: Response) => {
    const resetPasswordRequest: ResetPasswordInput = req.body;
    const requestOrigin = this.requestContextExtractor.extractRequestOrigin(req);
    await this.passwordResetService.resetPassword(resetPasswordRequest, requestOrigin);
    sendSuccessMessage(res, HttpStatus.OK, PASSWORD_SUCCESS_MESSAGES.PASSWORD_RESET);
  };
}
