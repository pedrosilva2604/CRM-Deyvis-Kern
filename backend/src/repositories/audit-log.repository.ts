import type { PrismaClient } from '@prisma/client';
import type { AuditLogInput } from '@/models/audit.model';

export type CreateAuditLogInput = AuditLogInput & { userId?: string; ip?: string };

export interface IAuditLogRepository {
  createAuditLog(auditLogEntry: CreateAuditLogInput): Promise<void>;
}

export class PrismaAuditLogRepository implements IAuditLogRepository {
  constructor(private readonly db: PrismaClient) {}

  async createAuditLog(auditLogEntry: CreateAuditLogInput): Promise<void> {
    await this.db.auditLog.create({ data: auditLogEntry });
  }
}
