import type { Request, Response } from 'express';
import type { RequestContextExtractor } from '@/lib/request-context-extractor';
import type { ForgotPasswordInput, ResetPasswordInput } from '@/models/auth.model';
import type { MessageOutput } from '@/models/common.model';
import type { IPasswordResetService } from '@/services/password-reset.service';

export class PasswordController {
  constructor(
    private readonly passwordResetService: IPasswordResetService,
    private readonly requestContextExtractor: RequestContextExtractor,
  ) {}

  requestPasswordReset = async (req: Request, res: Response) => {
    const forgotPasswordRequest: ForgotPasswordInput = req.body;
    await this.passwordResetService.requestPasswordReset(forgotPasswordRequest, this.requestContextExtractor.extractRequestOrigin(req));
    res.status(200).json({
      message: 'Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.',
    } satisfies MessageOutput);
  };

  resetPassword = async (req: Request, res: Response) => {
    const resetPasswordRequest: ResetPasswordInput = req.body;
    await this.passwordResetService.resetPassword(resetPasswordRequest, this.requestContextExtractor.extractRequestOrigin(req));
    res.status(200).json({ message: 'Senha redefinida com sucesso.' } satisfies MessageOutput);
  };
}
