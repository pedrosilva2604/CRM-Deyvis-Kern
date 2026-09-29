import type { Request, Response } from 'express';
import type { RequestContextExtractor } from '@/lib/request-context-extractor';
import type { SessionCookie } from '@/lib/session-cookie';
import type { LoginInput, SessionOutput } from '@/models/auth.model';
import type { IAuthService } from '@/services/auth.service';

export class AuthController {
  constructor(
    private readonly authService: IAuthService,
    private readonly requestContextExtractor: RequestContextExtractor,
    private readonly sessionCookie: SessionCookie,
  ) {}

  loginUser = async (req: Request, res: Response) => {
    const loginCredentials: LoginInput = req.body;
    const { token, ...session } = await this.authService.loginUser(loginCredentials, this.requestContextExtractor.extractRequestOrigin(req));
    this.sessionCookie.writeSessionToken(res, token, session.expiresAt);
    res.status(200).json(session satisfies SessionOutput);
  };

  getLoggedUser = async (req: Request, res: Response) => {
    const session = await this.authService.getLoggedUser(this.requestContextExtractor.extractLoggedUser(req));
    res.status(200).json(session);
  };

  logoutUser = async (req: Request, res: Response) => {
    await this.authService.logoutUser(this.requestContextExtractor.extractLoggedUser(req), this.requestContextExtractor.extractRequestOrigin(req));
    this.sessionCookie.clearSessionToken(res);
    res.status(204).send();
  };
}
