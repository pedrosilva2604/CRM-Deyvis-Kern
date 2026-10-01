import { NotFoundError } from '@/errors/app-errors';
import { NOTIFICATION_ERRORS } from '@/errors/errors.constants';
import type { Clock } from '@/infra/clock';
import { REALTIME_EVENTS, type IRealtimePublisher } from '@/infra/realtime-events';
import type { LoggedUserContext } from '@/models/common.model';
import type {
  MarkNotificationAsReadRequest,
  NotificationContent,
  NotificationList,
} from '@/models/notification.model';
import type { INotificationRepository } from '@/repositories/notification.repository';

const DAY_MS = 24 * 60 * 60 * 1000;
const LATEST_NOTIFICATIONS_LIMIT = 30;

export interface NotificationSettings {
  readRetentionDays: number;
}

export interface INotificationService {
  notifyUser(userId: string, notification: NotificationContent): Promise<void>;
  listNotifications(loggedUserContext: LoggedUserContext): Promise<NotificationList>;
  markNotificationAsRead(request: MarkNotificationAsReadRequest, loggedUserContext: LoggedUserContext): Promise<void>;
  markAllNotificationsAsRead(loggedUserContext: LoggedUserContext): Promise<void>;
  deleteOldReadNotifications(): Promise<number>;
}

export class NotificationService implements INotificationService {
  constructor(
    private readonly notificationRepository: INotificationRepository,
    private readonly realtimePublisher: IRealtimePublisher,
    private readonly clock: Clock,
    private readonly settings: NotificationSettings,
  ) {}

  async notifyUser(userId: string, notification: NotificationContent): Promise<void> {
    const createdNotification = await this.notificationRepository.createNotification({ userId, ...notification });
    await this.realtimePublisher.publishToUser(userId, REALTIME_EVENTS.NOTIFICATION_CREATED, { ...createdNotification });
  }

  async listNotifications({ loggedUser }: LoggedUserContext): Promise<NotificationList> {
    const [notifications, unreadCount] = await Promise.all([
      this.notificationRepository.findLatestNotifications(loggedUser.id, LATEST_NOTIFICATIONS_LIMIT),
      this.notificationRepository.countUnreadNotifications(loggedUser.id),
    ]);
    return { notifications, unreadCount };
  }

  async markNotificationAsRead(
    { targetNotificationId }: MarkNotificationAsReadRequest,
    { loggedUser }: LoggedUserContext,
  ): Promise<void> {
    const markedAsRead = await this.notificationRepository.markNotificationAsRead(targetNotificationId, loggedUser.id, this.clock.now());
    if (!markedAsRead) throw new NotFoundError(NOTIFICATION_ERRORS.NOT_FOUND);
  }

  async markAllNotificationsAsRead({ loggedUser }: LoggedUserContext): Promise<void> {
    await this.notificationRepository.markAllNotificationsAsRead(loggedUser.id, this.clock.now());
  }

  async deleteOldReadNotifications(): Promise<number> {
    const readBefore = new Date(this.clock.now().getTime() - this.settings.readRetentionDays * DAY_MS);
    return await this.notificationRepository.deleteNotificationsReadBefore(readBefore);
  }
}
