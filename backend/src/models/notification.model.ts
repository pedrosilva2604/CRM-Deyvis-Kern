import type { Notification, NotificationType } from '@prisma/client';

export interface NotificationContent {
  type: NotificationType;
  title: string;
  message: string;
  actionUrl: string | null;
}

export interface CreateNotificationData extends NotificationContent {
  userId: string;
}

export interface NotificationOutput extends NotificationContent {
  id: string;
  readAt: Date | null;
  createdAt: Date;
}

export interface NotificationList {
  notifications: NotificationOutput[];
  unreadCount: number;
}

export type NotificationIdParams = {
  notificationId: string;
};

export interface MarkNotificationAsReadRequest {
  targetNotificationId: string;
}

export function toNotificationOutput(notification: Notification): NotificationOutput {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    actionUrl: notification.actionUrl,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
  };
}
