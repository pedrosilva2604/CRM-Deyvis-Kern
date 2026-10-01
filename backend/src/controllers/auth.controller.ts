import type { Request, Response } from 'express';
import { AUTH_SUCCESS_MESSAGES } from '@/constants/success-messages';
import { HttpStatus, sendSuccessMessage } from '@/infra/http-status';
import type { RequestContextExtractor } from '@/infra/request-context-extractor';
import type { SessionCookie } from '@/infra/session-cookie';
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
    const requestOrigin = this.requestContextExtractor.extractRequestOrigin(req);
    const { token, ...session } = await this.authService.loginUser(loginCredentials, requestOrigin);
    this.sessionCookie.writeSessionToken(res, token, session.expiresAt);
    res.status(HttpStatus.OK).json(session satisfies SessionOutput);
  };

  getLoggedUser = async (req: Request, res: Response) => {
    const loggedUser = this.requestContextExtractor.extractLoggedUser(req);
    const session = await this.authService.getLoggedUser(loggedUser);
    res.status(HttpStatus.OK).json(session);
  };

  logoutUser = async (req: Request, res: Response) => {
    const loggedUser = this.requestContextExtractor.extractLoggedUser(req);
    const requestOrigin = this.requestContextExtractor.extractRequestOrigin(req);
    await this.authService.logoutUser(loggedUser, requestOrigin);
    this.sessionCookie.clearSessionToken(res);
    sendSuccessMessage(res, HttpStatus.OK, AUTH_SUCCESS_MESSAGES.LOGGED_OUT);
  };
}
