import type { AuditLogInput } from '@/models/audit.model';
import type { DatabaseClient } from '@/repositories/database-client';

export type CreateAuditLogInput = AuditLogInput & { userId?: string; ip?: string };

export interface IAuditLogRepository {
  createAuditLog(auditLogEntry: CreateAuditLogInput): Promise<void>;
}

export class PrismaAuditLogRepository implements IAuditLogRepository {
  constructor(private readonly db: DatabaseClient) {}

  async createAuditLog(auditLogEntry: CreateAuditLogInput): Promise<void> {
    await this.db.auditLog.create({ data: auditLogEntry });
  }
}
