import { Role } from '@prisma/client';
import { readLeadPhone, readSpreadsheetDate } from '@crm/shared';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '@/errors/app-errors';
import { AUTH_ERRORS, LEAD_ERRORS } from '@/errors/errors.constants';
import type { BusinessCalendar } from '@/infra/business-calendar';
import type { Clock } from '@/infra/clock';
import type { AuditLogInput } from '@/models/audit.model';
import type { LoggedUserContext } from '@/models/common.model';
import type {
  ContactInUse,
  CreateLeadInput,
  DeleteLeadRequest,
  LeadContact,
  LeadDetailsRequest,
  LeadFilterOptions,
  LeadListFilters,
  LeadListPage,
  LeadOutput,
  LeadSearch,
  LeadUpdateResult,
  UpdatableLeadField,
  UpdateLeadData,
  UpdateLeadInput,
  UpdateLeadRequest,
} from '@/models/lead.model';
import type { ILeadRepository } from '@/repositories/lead.repository';
import type { IUserRepository } from '@/repositories/user.repository';
import type { IAuditService } from './audit.service';

export interface ILeadService {
  listLeads(filters: LeadListFilters): Promise<LeadListPage>;
  getLeadDetails(request: LeadDetailsRequest): Promise<LeadOutput>;
  getLeadFilterOptions(): Promise<LeadFilterOptions>;
  createLead(newLead: CreateLeadInput, loggedUserContext: LoggedUserContext): Promise<LeadOutput>;
  updateLead(request: UpdateLeadRequest, loggedUserContext: LoggedUserContext): Promise<LeadUpdateResult>;
  deleteLead(request: DeleteLeadRequest, loggedUserContext: LoggedUserContext): Promise<void>;
}

const MESSAGE_BY_CONTACT_IN_USE: Record<ContactInUse, string> = {
  phone: LEAD_ERRORS.PHONE_IN_USE,
  email: LEAD_ERRORS.EMAIL_IN_USE,
};

export class LeadService implements ILeadService {
  constructor(
    private readonly leadRepository: ILeadRepository,
    private readonly userRepository: IUserRepository,
    private readonly audit: IAuditService,
    private readonly businessCalendar: BusinessCalendar,
    private readonly clock: Clock,
  ) {}

  async listLeads({ search, ...filters }: LeadListFilters): Promise<LeadListPage> {
    return await this.leadRepository.findLeadsPage({
      ...filters,
      ...(search && { search: this.interpretLeadSearch(search) }),
    });
  }

  async getLeadDetails({ targetLeadId }: LeadDetailsRequest): Promise<LeadOutput> {
    return await this.findExistingLeadOrFail(targetLeadId);
  }

  async getLeadFilterOptions(): Promise<LeadFilterOptions> {
    const [sources, assignees] = await Promise.all([
      this.leadRepository.findSourcesInUse(),
      this.userRepository.findActiveUsersForAssignment(),
    ]);
    return { sources, assignees };
  }

  async createLead(newLead: CreateLeadInput, loggedUserContext: LoggedUserContext): Promise<LeadOutput> {
    await this.assertContactIsAvailable({ phone: newLead.phone, email: newLead.email }, null);

    const leadCreation = await this.leadRepository.createLead({
      name: newLead.name,
      phone: newLead.phone,
      phoneCountry: this.countryOfPhone(newLead.phone),
      email: newLead.email,
      source: newLead.source,
      tags: newLead.tags,
      value: newLead.value,
      enteredOn: this.readEnteredOnOrToday(newLead.enteredOn),
      assignedToId: newLead.assignedToId,
    });
    if (leadCreation.outcome === 'assigneeNotAvailable') throw new BadRequestError(LEAD_ERRORS.ASSIGNEE_NOT_AVAILABLE);

    await this.recordLeadAuditLog(loggedUserContext, 'lead.create', leadCreation.lead.id, undefined);
    return leadCreation.lead;
  }

  async updateLead(
    { targetLeadId, leadChanges }: UpdateLeadRequest,
    loggedUserContext: LoggedUserContext,
  ): Promise<LeadUpdateResult> {
    const existingLead = await this.findExistingLeadOrFail(targetLeadId);
    const updatedFields = this.listFieldsThatChange(existingLead, leadChanges);
    if (updatedFields.length === 0) return { updatedFields };

    const effectiveChanges = this.keepOnlyFields(leadChanges, updatedFields);
    await this.assertContactIsAvailable({ phone: effectiveChanges.phone, email: effectiveChanges.email }, targetLeadId);

    const leadData: UpdateLeadData = {
      name: effectiveChanges.name,
      email: effectiveChanges.email,
      source: effectiveChanges.source,
      tags: effectiveChanges.tags,
      value: effectiveChanges.value,
      assignedToId: effectiveChanges.assignedToId,
      contactStatus: effectiveChanges.contactStatus,
      ...(effectiveChanges.phone && {
        phone: effectiveChanges.phone,
        phoneCountry: this.countryOfPhone(effectiveChanges.phone),
      }),
      ...(effectiveChanges.enteredOn && { enteredOn: this.readEnteredOnOrToday(effectiveChanges.enteredOn) }),
    };

    const leadUpdate = await this.leadRepository.updateLead(targetLeadId, leadData);
    if (leadUpdate === 'leadNotFound') throw new NotFoundError(LEAD_ERRORS.NOT_FOUND);
    if (leadUpdate === 'assigneeNotAvailable') throw new BadRequestError(LEAD_ERRORS.ASSIGNEE_NOT_AVAILABLE);
    await this.recordLeadAuditLog(loggedUserContext, 'lead.update', targetLeadId, { updatedFields });
    return { updatedFields };
  }

  async deleteLead({ targetLeadId }: DeleteLeadRequest, loggedUserContext: LoggedUserContext): Promise<void> {
    this.assertLoggedUserIsAdmin(loggedUserContext);
    await this.findExistingLeadOrFail(targetLeadId);

    await this.leadRepository.eraseLead({
      leadId: targetLeadId,
      deletedAt: this.clock.now(),
      deletedById: loggedUserContext.loggedUser.id,
    });
    await this.recordLeadAuditLog(loggedUserContext, 'lead.delete', targetLeadId, undefined);
  }

  private async assertContactIsAvailable(contact: LeadContact, leadBeingEdited: string | null): Promise<void> {
    const contactInUse = await this.leadRepository.findContactInUse(contact, leadBeingEdited);
    if (contactInUse) throw new ConflictError(MESSAGE_BY_CONTACT_IN_USE[contactInUse]);
  }

  private listFieldsThatChange(existingLead: LeadOutput, leadChanges: UpdateLeadInput): UpdatableLeadField[] {
    const currentValueByField: Record<UpdatableLeadField, unknown> = {
      name: existingLead.name,
      phone: existingLead.phone,
      email: existingLead.email,
      enteredOn: existingLead.enteredOn,
      source: existingLead.source,
      tags: existingLead.tags,
      value: existingLead.value,
      assignedToId: existingLead.assignedTo?.id ?? null,
      contactStatus: existingLead.contactStatus,
    };
    return (Object.keys(leadChanges) as UpdatableLeadField[]).filter((field) => {
      const requestedValue = leadChanges[field];
      return requestedValue !== undefined && JSON.stringify(requestedValue) !== JSON.stringify(currentValueByField[field]);
    });
  }

  private keepOnlyFields(leadChanges: UpdateLeadInput, fieldsToKeep: UpdatableLeadField[]): UpdateLeadInput {
    return Object.fromEntries(fieldsToKeep.map((field) => [field, leadChanges[field]])) as UpdateLeadInput;
  }

  private async findExistingLeadOrFail(leadId: string): Promise<LeadOutput> {
    const lead = await this.leadRepository.findLeadById(leadId);
    if (!lead) throw new NotFoundError(LEAD_ERRORS.NOT_FOUND);
    return lead;
  }

  private assertLoggedUserIsAdmin({ loggedUser }: LoggedUserContext): void {
    if (loggedUser.role !== Role.ADMIN) throw new ForbiddenError(AUTH_ERRORS.ACCESS_DENIED);
  }

  private readEnteredOnOrToday(enteredOn: string | null): Date {
    if (enteredOn === null) return this.businessCalendar.toDatabaseDate(this.businessCalendar.todayAsIsoDate());
    const dateReading = readSpreadsheetDate(enteredOn, this.businessCalendar.todayAsCalendarDate());
    if (dateReading.status !== 'valid') {
      throw new BadRequestError(dateReading.status === 'invalid' ? dateReading.reason : 'Informe a data de entrada');
    }
    return this.businessCalendar.toDatabaseDate(dateReading.isoDate);
  }

  private interpretLeadSearch(search: string): LeadSearch {
    const phoneReading = readLeadPhone(search);
    if (phoneReading.status === 'valid') return { searchedBy: 'phone', internationalPhone: phoneReading.internationalPhone };
    return { searchedBy: 'words', words: search };
  }

  private countryOfPhone(internationalPhone: string): string | null {
    const phoneReading = readLeadPhone(internationalPhone);
    return phoneReading.status === 'valid' ? (phoneReading.country ?? null) : null;
  }

  private async recordLeadAuditLog(
    loggedUserContext: LoggedUserContext,
    action: string,
    targetLeadId: string,
    details: AuditLogInput['details'],
  ): Promise<void> {
    await this.audit.recordAuditLog(loggedUserContext, { action, entity: 'Lead', entityId: targetLeadId, details });
  }
}
