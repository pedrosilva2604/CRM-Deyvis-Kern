import { Router } from 'express';
import type { AuthController } from '@/controllers/auth.controller';
import type { PasswordController } from '@/controllers/password.controller';
import { UnauthorizedError } from '@/errors/app-errors';
import { AUTH_ERRORS } from '@/errors/errors.constants';
import type { RateLimitMiddleware } from '@/middlewares/rate-limit.middleware';
import { forgotPasswordSchema, loginSchema, resetPasswordSchema } from '@/middlewares/schemas/auth.schema';
import type { ValidationMiddleware } from '@/middlewares/validation.middleware';

const invalidCredentials = () => new UnauthorizedError(AUTH_ERRORS.INVALID_CREDENTIALS);

export class AuthRoutes {
  readonly publicRouter = Router();
  readonly protectedRouter = Router();

  constructor(
    private readonly auth: AuthController,
    private readonly password: PasswordController,
    private readonly rateLimit: RateLimitMiddleware,
    private readonly validate: ValidationMiddleware,
  ) {
    this.registerPublicRoutes();
    this.registerProtectedRoutes();
  }

  private registerPublicRoutes() {
    this.publicRouter.post(
      '/login',
      this.rateLimit.loginLimiter,
      this.validate.validateBody(loginSchema, invalidCredentials),
      this.auth.loginUser,
    );
    this.publicRouter.post(
      '/forgot-password',
      this.rateLimit.forgotPasswordLimiter,
      this.validate.validateBody(forgotPasswordSchema),
      this.password.requestPasswordReset,
    );
    this.publicRouter.post(
      '/reset-password',
      this.rateLimit.resetPasswordLimiter,
      this.validate.validateBody(resetPasswordSchema),
      this.password.resetPassword,
    );
  }

  private registerProtectedRoutes() {
    this.protectedRouter.get('/logged-user', this.auth.getLoggedUser);
    this.protectedRouter.post('/logout', this.auth.logoutUser);
  }
}
