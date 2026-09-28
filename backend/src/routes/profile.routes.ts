import { Router } from 'express';
import type { ProfileController } from '@/controllers/profile.controller';
import { updateThemeSchema } from '@/middlewares/schemas/user.schema';
import type { ValidationMiddleware } from '@/middlewares/validation.middleware';

export class ProfileRoutes {
  readonly router = Router();

  constructor(
    private readonly profile: ProfileController,
    private readonly validate: ValidationMiddleware,
  ) {
    this.router.patch('/theme', this.validate.validateBody(updateThemeSchema), this.profile.updateUserTheme);
  }
}
