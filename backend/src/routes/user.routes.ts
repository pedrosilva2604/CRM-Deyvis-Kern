import { Router } from 'express';
import type { UserController } from '@/controllers/user.controller';
import type { AuthMiddleware } from '@/middlewares/auth.middleware';
import {
  registerUserSchema,
  updateUserPasswordSchema,
  updateUserSchema,
  userIdParamsSchema,
} from '@/middlewares/schemas/user.schema';
import type { ValidationMiddleware } from '@/middlewares/validation.middleware';

export class UserRoutes {
  readonly router = Router();

  constructor(
    private readonly users: UserController,
    private readonly authMiddleware: AuthMiddleware,
    private readonly validate: ValidationMiddleware,
  ) {
    this.restrictToAdmins();
    this.registerRoutes();
  }

  private restrictToAdmins() {
    this.router.use(this.authMiddleware.requireRole('ADMIN'));
  }

  private registerRoutes() {
    this.router.get('/', this.users.listUsers);
    this.router.post('/', this.validate.validateBody(registerUserSchema), this.users.registerUser);
    this.router.patch(
      '/:id',
      this.validate.validateParams(userIdParamsSchema),
      this.validate.validateBody(updateUserSchema),
      this.users.updateUser,
    );
    this.router.patch('/:id/activate', this.validate.validateParams(userIdParamsSchema), this.users.activateUser);
    this.router.patch('/:id/deactivate', this.validate.validateParams(userIdParamsSchema), this.users.deactivateUser);
    this.router.patch(
      '/:id/password',
      this.validate.validateParams(userIdParamsSchema),
      this.validate.validateBody(updateUserPasswordSchema),
      this.users.updateUserPassword,
    );
    this.router.delete('/:id', this.validate.validateParams(userIdParamsSchema), this.users.deleteUser);
  }
}
