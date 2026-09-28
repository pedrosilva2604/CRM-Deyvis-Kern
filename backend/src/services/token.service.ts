import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '@/errors/app-errors';
import { AUTH_ERRORS } from '@/errors/errors.constants';
import type { TokenPayload } from '@/models/auth.model';

export interface ITokenService {
  signSessionToken(payload: TokenPayload, expiresAt: Date): string;
  verifySessionToken(token: string): TokenPayload;
}

export class JwtTokenService implements ITokenService {
  private readonly algorithm = 'HS256';

  constructor(private readonly secret: string) {}

  signSessionToken(payload: TokenPayload, expiresAt: Date) {
    return jwt.sign({ sid: payload.sid, exp: Math.floor(expiresAt.getTime() / 1000) }, this.secret, {
      algorithm: this.algorithm,
    });
  }

  verifySessionToken(token: string): TokenPayload {
    try {
      const { sid } = jwt.verify(token, this.secret, { algorithms: [this.algorithm] }) as TokenPayload;
      return { sid };
    } catch {
      throw new UnauthorizedError(AUTH_ERRORS.INVALID_SESSION);
    }
  }
}
