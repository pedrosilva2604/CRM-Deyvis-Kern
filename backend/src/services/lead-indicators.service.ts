import type { BusinessCalendar } from '@/infra/business-calendar';
import type {
  CompleteProfilesIndicator,
  InvalidOrRejectedContactsIndicator,
  NewLeadsIndicator,
  TotalLeadsIndicator,
  UnassignedLeadsIndicator,
} from '@/models/lead-indicators.model';
import type { ILeadIndicatorsRepository } from '@/repositories/lead-indicators.repository';

const NEW_LEAD_WINDOW_DAYS = 7;
const SHARE_PRECISION = 10_000;

export interface ILeadIndicatorsService {
  getTotalLeads(): Promise<TotalLeadsIndicator>;
  getNewLeadsInLastSevenDays(): Promise<NewLeadsIndicator>;
  getUnassignedLeads(): Promise<UnassignedLeadsIndicator>;
  getInvalidOrRejectedContacts(): Promise<InvalidOrRejectedContactsIndicator>;
  getCompleteProfiles(): Promise<CompleteProfilesIndicator>;
}

export class LeadIndicatorsService implements ILeadIndicatorsService {
  constructor(
    private readonly leadIndicatorsRepository: ILeadIndicatorsRepository,
    private readonly businessCalendar: BusinessCalendar,
  ) {}

  async getTotalLeads(): Promise<TotalLeadsIndicator> {
    return { totalLeads: await this.leadIndicatorsRepository.countActiveLeads() };
  }

  async getNewLeadsInLastSevenDays(): Promise<NewLeadsIndicator> {
    const firstDayCountedAsNew = this.findFirstDayCountedAsNew();
    return { newLeadsInLastSevenDays: await this.leadIndicatorsRepository.countLeadsEnteredSince(firstDayCountedAsNew) };
  }

  async getUnassignedLeads(): Promise<UnassignedLeadsIndicator> {
    const [unassignedLeads, totalLeads] = await Promise.all([
      this.leadIndicatorsRepository.countUnassignedLeads(),
      this.leadIndicatorsRepository.countActiveLeads(),
    ]);
    return { unassignedLeads, shareOfBase: this.calculateShareOfBase(unassignedLeads, totalLeads) };
  }

  async getInvalidOrRejectedContacts(): Promise<InvalidOrRejectedContactsIndicator> {
    const [invalidOrRejectedContacts, totalLeads] = await Promise.all([
      this.leadIndicatorsRepository.countLeadsWithInvalidOrRejectedContact(),
      this.leadIndicatorsRepository.countActiveLeads(),
    ]);
    return { invalidOrRejectedContacts, shareOfBase: this.calculateShareOfBase(invalidOrRejectedContacts, totalLeads) };
  }

  async getCompleteProfiles(): Promise<CompleteProfilesIndicator> {
    const [completeProfiles, totalLeads] = await Promise.all([
      this.countCompleteProfiles(),
      this.leadIndicatorsRepository.countActiveLeads(),
    ]);
    return { completeProfiles, shareOfBase: this.calculateShareOfBase(completeProfiles, totalLeads) };
  }

  private async countCompleteProfiles(): Promise<number> {
    return await this.leadIndicatorsRepository.countLeadsWithEmail();
  }

  private calculateShareOfBase(quantity: number, totalLeads: number): number {
    if (totalLeads === 0) return 0;
    return Math.round((quantity / totalLeads) * SHARE_PRECISION) / SHARE_PRECISION;
  }

  private findFirstDayCountedAsNew(): Date {
    const firstDayCountedAsNew = this.businessCalendar.isoDateDaysBeforeToday(NEW_LEAD_WINDOW_DAYS - 1);
    return this.businessCalendar.toDatabaseDate(firstDayCountedAsNew);
  }
}
