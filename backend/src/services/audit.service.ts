import type { AuditLogInput } from '@/models/audit.model';
import type { RequestOrigin } from '@/models/common.model';
import type { IAuditLogRepository } from '@/repositories/audit-log.repository';

export interface IAuditService {
  recordAuditLog(requestOrigin: RequestOrigin, auditLogEntry: AuditLogInput): Promise<void>;
}

export class AuditService implements IAuditService {
  constructor(private readonly auditLogs: IAuditLogRepository) {}

  async recordAuditLog(requestOrigin: RequestOrigin, auditLogEntry: AuditLogInput): Promise<void> {
    await this.auditLogs.createAuditLog({ ...auditLogEntry, userId: requestOrigin.userId, ip: requestOrigin.ip });
  }
}
