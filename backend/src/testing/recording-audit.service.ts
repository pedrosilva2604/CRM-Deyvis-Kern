import type { AuditLogInput } from '@/models/audit.model';
import type { RequestOrigin } from '@/models/common.model';
import type { IAuditService } from '@/services/audit.service';

export interface RecordedAuditLog {
  userId: string | undefined;
  action: string;
  entityId: string | undefined;
}

export class RecordingAuditService implements IAuditService {
  readonly recordedAuditLogs: RecordedAuditLog[] = [];

  async recordAuditLog(requestOrigin: RequestOrigin, auditLogEntry: AuditLogInput): Promise<void> {
    this.recordedAuditLogs.push({ userId: requestOrigin.userId, action: auditLogEntry.action, entityId: auditLogEntry.entityId });
  }
}
