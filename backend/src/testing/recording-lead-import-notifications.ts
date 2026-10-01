import type { FinishedLeadImport } from '@/models/lead-import.model';
import type { ILeadImportNotificationService } from '@/services/lead-import-notification.service';

export type SentLeadImportNotification = {
  situation: 'completed' | 'failed' | 'expiring' | 'expired';
  importId: string;
};

export class RecordingLeadImportNotifications implements ILeadImportNotificationService {
  readonly sentNotifications: SentLeadImportNotification[] = [];

  async notifyImportCompleted({ importId }: FinishedLeadImport): Promise<void> {
    this.sentNotifications.push({ situation: 'completed', importId });
  }

  async notifyImportFailed({ importId }: FinishedLeadImport): Promise<void> {
    this.sentNotifications.push({ situation: 'failed', importId });
  }

  async notifyImportExpiring({ importId }: FinishedLeadImport): Promise<void> {
    this.sentNotifications.push({ situation: 'expiring', importId });
  }

  async notifyImportExpired({ importId }: FinishedLeadImport): Promise<void> {
    this.sentNotifications.push({ situation: 'expired', importId });
  }
}
