import { z, type ZodType, type ZodTypeDef } from 'zod';
import type { NotificationIdParams } from '@/models/notification.model';

export const notificationIdParamsSchema: ZodType<NotificationIdParams, ZodTypeDef, unknown> = z.object({
  notificationId: z.string().uuid('Identificador de notificação inválido'),
});
