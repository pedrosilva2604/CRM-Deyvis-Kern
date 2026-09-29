import { Role } from '@prisma/client';
import { readLeadPhone, readSpreadsheetDate } from '@crm/shared';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/errors/app-errors';
import { AUTH_ERRORS, LEAD_ERRORS } from '@/errors/errors.constants';
import type { BusinessCalendar } from '@/lib/business-calendar';
import type { Clock } from '@/lib/clock';
import type { AuditLogInput } from '@/models/audit.model';
import type { LoggedUserContext } from '@/models/common.model';
import type {
  CreateLeadInput,
  DeleteLeadRequest,
  LeadBaseIndicators,
  LeadDetailsRequest,
  LeadFilterOptions,
  LeadListFilters,
  LeadListPage,
  LeadOutput,
  UpdateLeadData,
  UpdateLeadRequest,
} from '@/models/lead.model';
import type { ILeadRepository } from '@/repositories/lead.repository';
import type { IPipelineRepository, StageLocation } from '@/repositories/pipeline.repository';
import type { IUserRepository } from '@/repositories/user.repository';
import type { IAuditService } from './audit.service';

const NEW_LEAD_WINDOW_DAYS = 7;

export interface ILeadService {
  listLeads(filters: LeadListFilters): Promise<LeadListPage>;
  getLeadDetails(request: LeadDetailsRequest): Promise<LeadOutput>;
  getLeadBaseIndicators(): Promise<LeadBaseIndicators>;
  getLeadFilterOptions(): Promise<LeadFilterOptions>;
  createLead(newLead: CreateLeadInput, loggedUserContext: LoggedUserContext): Promise<LeadOutput>;
  updateLead(request: UpdateLeadRequest, loggedUserContext: LoggedUserContext): Promise<LeadOutput>;
  deleteLead(request: DeleteLeadRequest, loggedUserContext: LoggedUserContext): Promise<void>;
}

export class LeadService implements ILeadService {
  constructor(
    private readonly leadRepository: ILeadRepository,
    private readonly pipelineRepository: IPipelineRepository,
    private readonly userRepository: IUserRepository,
    private readonly audit: IAuditService,
    private readonly businessCalendar: BusinessCalendar,
    private readonly clock: Clock,
  ) {}

  async listLeads(filters: LeadListFilters): Promise<LeadListPage> {
    return await this.leadRepository.findLeadsPage(filters);
  }

  async getLeadDetails({ targetLeadId }: LeadDetailsRequest): Promise<LeadOutput> {
    return await this.findExistingLeadOrFail(targetLeadId);
  }

  async getLeadBaseIndicators(): Promise<LeadBaseIndicators> {
    const firstDayCountedAsNew = this.businessCalendar.isoDateDaysBeforeToday(NEW_LEAD_WINDOW_DAYS - 1);
    return await this.leadRepository.countLeadBaseIndicators(this.businessCalendar.toDatabaseDate(firstDayCountedAsNew));
  }

  async getLeadFilterOptions(): Promise<LeadFilterOptions> {
    const [pipelines, sources, assignees] = await Promise.all([
      this.pipelineRepository.findPipelinesWithStages(),
      this.leadRepository.findSourcesInUse(),
      this.userRepository.findActiveUsersForAssignment(),
    ]);
    return { pipelines, sources, assignees };
  }

  async createLead(newLead: CreateLeadInput, loggedUserContext: LoggedUserContext): Promise<LeadOutput> {
    const stageLocation = await this.findStageLocationOrFail(newLead.stageId);
    if (newLead.assignedToId) await this.assertAssigneeIsAvailable(newLead.assignedToId);

    const createdLead = await this.leadRepository.createLead({
      name: newLead.name,
      phone: newLead.phone,
      phoneCountry: this.countryOfPhone(newLead.phone),
      email: newLead.email,
      source: newLead.source,
      tags: newLead.tags,
      value: newLead.value,
      enteredOn: this.readEnteredOnOrToday(newLead.enteredOn),
      pipelineId: stageLocation.pipelineId,
      stageId: stageLocation.stageId,
      assignedToId: newLead.assignedToId,
    });

    await this.recordLeadAuditLog(loggedUserContext, 'lead.create', createdLead.id, {
      name: createdLead.name,
      phone: createdLead.phone,
    });
    return createdLead;
  }

  async updateLead(
    { targetLeadId, leadChanges }: UpdateLeadRequest,
    loggedUserContext: LoggedUserContext,
  ): Promise<LeadOutput> {
    await this.findExistingLeadOrFail(targetLeadId);
    if (leadChanges.assignedToId) await this.assertAssigneeIsAvailable(leadChanges.assignedToId);

    const stageLocation = leadChanges.stageId ? await this.findStageLocationOrFail(leadChanges.stageId) : null;
    const leadData: UpdateLeadData = {
      name: leadChanges.name,
      email: leadChanges.email,
      source: leadChanges.source,
      tags: leadChanges.tags,
      value: leadChanges.value,
      assignedToId: leadChanges.assignedToId,
      contactStatus: leadChanges.contactStatus,
      ...(leadChanges.phone && { phone: leadChanges.phone, phoneCountry: this.countryOfPhone(leadChanges.phone) }),
      ...(leadChanges.enteredOn && { enteredOn: this.readEnteredOnOrToday(leadChanges.enteredOn) }),
      ...(stageLocation && { stageId: stageLocation.stageId, pipelineId: stageLocation.pipelineId }),
    };

    const updatedLead = await this.leadRepository.updateLead(targetLeadId, leadData);
    await this.recordLeadAuditLog(loggedUserContext, 'lead.update', targetLeadId, { changedFields: Object.keys(leadChanges) });
    return updatedLead;
  }

  async deleteLead({ targetLeadId }: DeleteLeadRequest, loggedUserContext: LoggedUserContext): Promise<void> {
    this.assertLoggedUserIsAdmin(loggedUserContext);
    const leadToDelete = await this.findExistingLeadOrFail(targetLeadId);

    await this.leadRepository.softDeleteLead(targetLeadId, this.clock.now());
    await this.recordLeadAuditLog(loggedUserContext, 'lead.delete', targetLeadId, {
      name: leadToDelete.name,
      phone: leadToDelete.phone,
    });
  }

  private async findExistingLeadOrFail(leadId: string): Promise<LeadOutput> {
    const lead = await this.leadRepository.findLeadById(leadId);
    if (!lead) throw new NotFoundError(LEAD_ERRORS.NOT_FOUND);
    return lead;
  }

  private async findStageLocationOrFail(stageId: string): Promise<StageLocation> {
    const stageLocation = await this.pipelineRepository.findStageLocation(stageId);
    if (!stageLocation) throw new BadRequestError(LEAD_ERRORS.STAGE_NOT_FOUND);
    return stageLocation;
  }

  private async assertAssigneeIsAvailable(assigneeId: string): Promise<void> {
    if (!(await this.userRepository.isActiveUser(assigneeId))) throw new BadRequestError(LEAD_ERRORS.ASSIGNEE_NOT_AVAILABLE);
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
