import { toNotificationOutput, type CreateNotificationData, type NotificationOutput } from '@/models/notification.model';
import type { DatabaseClient } from '@/repositories/database-client';

export interface INotificationRepository {
  createNotification(newNotification: CreateNotificationData): Promise<NotificationOutput>;
  findLatestNotifications(userId: string, limit: number): Promise<NotificationOutput[]>;
  countUnreadNotifications(userId: string): Promise<number>;
  markNotificationAsRead(notificationId: string, userId: string, readAt: Date): Promise<boolean>;
  markAllNotificationsAsRead(userId: string, readAt: Date): Promise<void>;
  deleteNotificationsReadBefore(readBefore: Date): Promise<number>;
}

export class NotificationRepository implements INotificationRepository {
  constructor(private readonly prisma: DatabaseClient) {}

  async createNotification(newNotification: CreateNotificationData): Promise<NotificationOutput> {
    const createdNotification = await this.prisma.notification.create({ data: newNotification });
    return toNotificationOutput(createdNotification);
  }

  async findLatestNotifications(userId: string, limit: number): Promise<NotificationOutput[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
    return notifications.map(toNotificationOutput);
  }

  async countUnreadNotifications(userId: string): Promise<number> {
    return await this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markNotificationAsRead(notificationId: string, userId: string, readAt: Date): Promise<boolean> {
    const ownNotification = await this.prisma.notification.findFirst({ where: { id: notificationId, userId }, select: { id: true } });
    if (!ownNotification) return false;
    await this.prisma.notification.updateMany({ where: { id: notificationId, userId, readAt: null }, data: { readAt } });
    return true;
  }

  async markAllNotificationsAsRead(userId: string, readAt: Date): Promise<void> {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt } });
  }

  async deleteNotificationsReadBefore(readBefore: Date): Promise<number> {
    const deletion = await this.prisma.notification.deleteMany({ where: { readAt: { lt: readBefore } } });
    return deletion.count;
  }
}
