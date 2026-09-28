import type { Prisma } from '@prisma/client';

export interface AuditLogInput {
  action: string;
  entity?: string;
  entityId?: string;
  details?: Prisma.InputJsonValue;
}
