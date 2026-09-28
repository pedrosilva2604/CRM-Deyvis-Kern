import type { AuditLogInput } from '@/models/audit.model';
import type { RequestContext } from '@/models/common.model';
import type { IAuditLogRepository } from '@/repositories/audit-log.repository';

export interface IAuditService {
  recordAuditLog(ctx: RequestContext, input: AuditLogInput): Promise<void>;
}

export class AuditService implements IAuditService {
  constructor(private readonly auditLogs: IAuditLogRepository) {}

  async recordAuditLog(ctx: RequestContext, input: AuditLogInput): Promise<void> {
    await this.auditLogs.createAuditLog({ ...input, userId: ctx.userId, ip: ctx.ip });
  }
}
