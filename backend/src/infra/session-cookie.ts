import { parse } from 'cookie';
import type { CookieOptions, Response } from 'express';

export interface SessionCookieConfig {
  name: string;
  secure: boolean;
}

export interface SessionCookie {
  writeSessionToken(res: Response, token: string, expiresAt: Date): void;
  clearSessionToken(res: Response): void;
  readSessionToken(cookieHeader: string | undefined): string | undefined;
}

export class HttpOnlySessionCookie implements SessionCookie {
  constructor(private readonly config: SessionCookieConfig) {}

  writeSessionToken(res: Response, token: string, expiresAt: Date) {
    res.cookie(this.config.name, token, { ...this.options(), expires: expiresAt });
  }

  clearSessionToken(res: Response) {
    res.clearCookie(this.config.name, this.options());
  }

  readSessionToken(cookieHeader: string | undefined) {
    if (!cookieHeader) return undefined;
    return parse(cookieHeader)[this.config.name] || undefined;
  }

  private options(): CookieOptions {
    return { httpOnly: true, secure: this.config.secure, sameSite: 'strict', path: '/' };
  }
}
