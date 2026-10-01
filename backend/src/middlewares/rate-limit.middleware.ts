import type { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { REQUEST_ERRORS } from '@/errors/errors.constants';

const MINUTE_MS = 60 * 1000;
const TOO_MANY_REQUESTS = { error: REQUEST_ERRORS.TOO_MANY_REQUESTS };

type LimiterKey = 'ip' | 'ipAndEmail' | 'loggedUser';

export interface RateLimitConfig {
  windowMinutes: number;
  apiLimit: number;
  loginLimit: number;
  forgotPasswordLimit: number;
  resetPasswordLimit: number;
  leadImportLimit: number;
  loggedUserApiLimit: number;
}

export class RateLimitMiddleware {
  readonly apiLimiter;
  readonly loginLimiter;
  readonly forgotPasswordLimiter;
  readonly resetPasswordLimiter;
  readonly leadImportLimiter;
  readonly loggedUserApiLimiter;

  constructor(private readonly config: RateLimitConfig) {
    this.apiLimiter = this.createLimiter(config.apiLimit);
    this.loginLimiter = this.createLimiter(config.loginLimit, { keyedBy: 'ipAndEmail', skipSuccessfulRequests: true });
    this.forgotPasswordLimiter = this.createLimiter(config.forgotPasswordLimit, { keyedBy: 'ipAndEmail' });
    this.resetPasswordLimiter = this.createLimiter(config.resetPasswordLimit);
    this.leadImportLimiter = this.createLimiter(config.leadImportLimit, { keyedBy: 'loggedUser' });
    this.loggedUserApiLimiter = this.createLimiter(config.loggedUserApiLimit, { keyedBy: 'loggedUser' });
  }

  private createLimiter(limit: number, options: { keyedBy?: LimiterKey; skipSuccessfulRequests?: boolean } = {}) {
    const keyedBy = options.keyedBy ?? 'ip';
    return rateLimit({
      windowMs: this.config.windowMinutes * MINUTE_MS,
      limit,
      skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
      keyGenerator: (req) => this.buildLimiterKey(req, keyedBy),
      message: TOO_MANY_REQUESTS,
    });
  }

  private buildLimiterKey(req: Request, keyedBy: LimiterKey) {
    const ipKey = ipKeyGenerator(req.ip ?? '');
    if (keyedBy === 'ipAndEmail') return `${ipKey}:${String(req.body?.email ?? '').trim().toLowerCase()}`;
    if (keyedBy === 'loggedUser') return req.user ? `user:${req.user.id}` : ipKey;
    return ipKey;
  }
}
