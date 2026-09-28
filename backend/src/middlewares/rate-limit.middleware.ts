import type { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { REQUEST_ERRORS } from '@/errors/errors.constants';

const MINUTE_MS = 60 * 1000;
const TOO_MANY_REQUESTS = { error: REQUEST_ERRORS.TOO_MANY_REQUESTS };

export interface RateLimitConfig {
  windowMinutes: number;
  apiLimit: number;
  loginLimit: number;
  forgotPasswordLimit: number;
  resetPasswordLimit: number;
}

export class RateLimitMiddleware {
  readonly apiLimiter;
  readonly loginLimiter;
  readonly forgotPasswordLimiter;
  readonly resetPasswordLimiter;

  constructor(private readonly config: RateLimitConfig) {
    this.apiLimiter = this.createLimiter(config.apiLimit);
    this.loginLimiter = this.createLimiter(config.loginLimit, { byEmail: true, skipSuccessfulRequests: true });
    this.forgotPasswordLimiter = this.createLimiter(config.forgotPasswordLimit, { byEmail: true });
    this.resetPasswordLimiter = this.createLimiter(config.resetPasswordLimit);
  }

  private createLimiter(limit: number, options: { byEmail?: boolean; skipSuccessfulRequests?: boolean } = {}) {
    return rateLimit({
      windowMs: this.config.windowMinutes * MINUTE_MS,
      limit,
      skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
      keyGenerator: options.byEmail ? (req) => this.byIpAndEmail(req) : (req) => ipKeyGenerator(req.ip ?? ''),
      message: TOO_MANY_REQUESTS,
    });
  }

  private byIpAndEmail(req: Request) {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    return `${ipKeyGenerator(req.ip ?? '')}:${email}`;
  }
}
