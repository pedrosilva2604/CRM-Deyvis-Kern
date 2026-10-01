import { Router } from 'express';
import type { NotificationController } from '@/controllers/notification.controller';
import { notificationIdParamsSchema } from '@/middlewares/schemas/notification.schema';
import type { ValidationMiddleware } from '@/middlewares/validation.middleware';

export class NotificationRoutes {
  readonly router = Router();

  constructor(
    private readonly notifications: NotificationController,
    private readonly validate: ValidationMiddleware,
  ) {
    this.router.get('/', this.notifications.listNotifications);
    this.router.patch('/read-all', this.notifications.markAllNotificationsAsRead);
    this.router.patch(
      '/:notificationId/read',
      this.validate.validateParams(notificationIdParamsSchema),
      this.notifications.markNotificationAsRead,
    );
  }
}
