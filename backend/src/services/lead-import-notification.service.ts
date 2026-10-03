import { NotificationType } from '@prisma/client';
import { LEAD_IMPORT_NOTIFICATION_MESSAGES } from '@/constants/notification-messages';
import type { FinishedLeadImport } from '@/models/lead-import.model';
import type { INotificationService } from './notification.service';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface LeadImportNotificationSettings {
  businessTimeZone: string;
  failedRetentionDays: number;
}

export interface ILeadImportNotificationService {
  notifyImportCompleted(finishedImport: FinishedLeadImport): Promise<void>;
  notifyImportFailed(finishedImport: FinishedLeadImport): Promise<void>;
  notifyImportExpiring(finishedImport: FinishedLeadImport): Promise<void>;
  notifyImportExpired(finishedImport: FinishedLeadImport): Promise<void>;
}

export class LeadImportNotificationService implements ILeadImportNotificationService {
  private readonly dateFormatter: Intl.DateTimeFormat;

  constructor(
    private readonly notificationService: INotificationService,
    private readonly settings: LeadImportNotificationSettings,
  ) {
    this.dateFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: settings.businessTimeZone, dateStyle: 'short' });
  }

  async notifyImportCompleted(finishedImport: FinishedLeadImport): Promise<void> {
    const { title, message } = LEAD_IMPORT_NOTIFICATION_MESSAGES.COMPLETED;
    await this.notifyRequester(finishedImport, NotificationType.LEAD_IMPORT_COMPLETED, title, message(finishedImport));
  }

  async notifyImportFailed(finishedImport: FinishedLeadImport): Promise<void> {
    const { title, message } = LEAD_IMPORT_NOTIFICATION_MESSAGES.FAILED;
    await this.notifyRequester(finishedImport, NotificationType.LEAD_IMPORT_FAILED, title, message(finishedImport.importedLeads, this.describeRetryDeadline(finishedImport)));
  }

  async notifyImportExpiring(finishedImport: FinishedLeadImport): Promise<void> {
    const { title, message } = LEAD_IMPORT_NOTIFICATION_MESSAGES.EXPIRING;
    await this.notifyRequester(finishedImport, NotificationType.LEAD_IMPORT_EXPIRING, title, message(this.describeRetryDeadline(finishedImport)));
  }

  async notifyImportExpired(finishedImport: FinishedLeadImport): Promise<void> {
    const { title, message } = LEAD_IMPORT_NOTIFICATION_MESSAGES.EXPIRED;
    await this.notifyRequester(finishedImport, NotificationType.LEAD_IMPORT_EXPIRED, title, message());
  }

  private trackingLinkOf({ importId, destination }: FinishedLeadImport): string {
    if (destination) return `/kanban?funil=${destination.pipelineId}&importacao=${importId}`;
    return `/leads?importacao=${importId}`;
  }

  private describeRetryDeadline({ finishedAt }: FinishedLeadImport): string {
    return this.dateFormatter.format(new Date(finishedAt.getTime() + this.settings.failedRetentionDays * DAY_MS));
  }

  private async notifyRequester(
    finishedImport: FinishedLeadImport,
    type: NotificationType,
    title: string,
    message: string,
  ): Promise<void> {
    await this.notificationService.notifyUser(finishedImport.requestedById, {
      type,
      title,
      message,
      actionUrl: this.trackingLinkOf(finishedImport),
    });
  }
}
