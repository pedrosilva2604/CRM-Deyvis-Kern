import type { Request, Response } from 'express';
import { NOTIFICATION_SUCCESS_MESSAGES } from '@/constants/success-messages';
import { HttpStatus, sendSuccessMessage } from '@/infra/http-status';
import type { RequestContextExtractor } from '@/infra/request-context-extractor';
import type { NotificationIdParams } from '@/models/notification.model';
import type { INotificationService } from '@/services/notification.service';

export class NotificationController {
  constructor(
    private readonly notificationService: INotificationService,
    private readonly requestContextExtractor: RequestContextExtractor,
  ) {}

  listNotifications = async (req: Request, res: Response) => {
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    const notificationList = await this.notificationService.listNotifications(loggedUserContext);
    res.status(HttpStatus.OK).json(notificationList);
  };

  markNotificationAsRead = async (req: Request<NotificationIdParams>, res: Response) => {
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    await this.notificationService.markNotificationAsRead({ targetNotificationId: req.params.notificationId }, loggedUserContext);
    sendSuccessMessage(res, HttpStatus.OK, NOTIFICATION_SUCCESS_MESSAGES.MARKED_AS_READ);
  };

  markAllNotificationsAsRead = async (req: Request, res: Response) => {
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    await this.notificationService.markAllNotificationsAsRead(loggedUserContext);
    sendSuccessMessage(res, HttpStatus.OK, NOTIFICATION_SUCCESS_MESSAGES.ALL_MARKED_AS_READ);
  };
}
