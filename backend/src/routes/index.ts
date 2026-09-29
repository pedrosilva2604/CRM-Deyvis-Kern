import { Router } from 'express';
import type { HealthController } from '@/controllers/health.controller';
import type { AuthMiddleware } from '@/middlewares/auth.middleware';
import type { RateLimitMiddleware } from '@/middlewares/rate-limit.middleware';
import type { AuthRoutes } from './auth.routes';
import type { LeadRoutes } from './lead.routes';
import type { ProfileRoutes } from './profile.routes';
import type { UserRoutes } from './user.routes';

export interface RouteGroups {
  auth: AuthRoutes;
  profile: ProfileRoutes;
  users: UserRoutes;
  leads: LeadRoutes;
}

export class AppRoutes {
  readonly router = Router();

  constructor(
    private readonly health: HealthController,
    private readonly groups: RouteGroups,
    private readonly authMiddleware: AuthMiddleware,
    private readonly rateLimit: RateLimitMiddleware,
  ) {
    this.router.use(this.rateLimit.apiLimiter);
    this.registerPublicRoutes();
    this.router.use(this.authMiddleware.authenticate);
    this.registerProtectedRoutes();
  }

  private registerPublicRoutes() {
    this.router.get('/health', this.health.checkHealth);
    this.router.use('/auth', this.groups.auth.publicRouter);
  }

  private registerProtectedRoutes() {
    this.router.use('/auth', this.groups.auth.protectedRouter);
    this.router.use('/profile', this.groups.profile.router);
    this.router.use('/users', this.groups.users.router);
    this.router.use('/leads', this.groups.leads.router);
  }
}
