import { NotificationType, Role } from '@prisma/client';
import { PIPELINE_NOTIFICATION_MESSAGES } from '@/constants/notification-messages';
import { MAXIMUM_STAGES_PER_PIPELINE } from '@/constants/pipeline-limits';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/errors/app-errors';
import { LEAD_ERRORS, PIPELINE_ERRORS } from '@/errors/errors.constants';
import type { Clock } from '@/infra/clock';
import type { AuditLogInput } from '@/models/audit.model';
import type { LoggedUserContext } from '@/models/common.model';
import type {
  AddCardRequest,
  CardClosing,
  CreatePipelineInput,
  CreateStageRequest,
  DeleteStageRequest,
  MoveCardInput,
  MoveCardRequest,
  PipelineAccess,
  PipelineCardRecord,
  PipelineMemberRequest,
  PipelineOutput,
  PipelinePersonOutput,
  PipelineRequest,
  RemoveCardRequest,
  RenamePipelineRequest,
  ReorderStagesRequest,
  StageCardsPage,
  StageCardsRequest,
  StageRecord,
  UpdateStageRequest,
} from '@/models/pipeline.model';
import type { ILeadRepository } from '@/repositories/lead.repository';
import type { IPipelineCardRepository } from '@/repositories/pipeline-card.repository';
import type { IPipelineRepository, PipelineViewer } from '@/repositories/pipeline.repository';
import type { IAuditService } from './audit.service';
import type { INotificationService } from './notification.service';
import type { IPipelineChangeAnnouncer } from './pipeline-change-announcer';

export interface IPipelineService {
  listPipelines(loggedUserContext: LoggedUserContext): Promise<PipelineOutput[]>;
  createPipeline(newPipeline: CreatePipelineInput, loggedUserContext: LoggedUserContext): Promise<void>;
  renamePipeline(request: RenamePipelineRequest, loggedUserContext: LoggedUserContext): Promise<void>;
  deletePipeline(request: PipelineRequest, loggedUserContext: LoggedUserContext): Promise<void>;
  listInvitableUsers(request: PipelineRequest, loggedUserContext: LoggedUserContext): Promise<PipelinePersonOutput[]>;
  addMember(request: PipelineMemberRequest, loggedUserContext: LoggedUserContext): Promise<void>;
  removeMember(request: PipelineMemberRequest, loggedUserContext: LoggedUserContext): Promise<void>;
  createStage(request: CreateStageRequest, loggedUserContext: LoggedUserContext): Promise<void>;
  updateStage(request: UpdateStageRequest, loggedUserContext: LoggedUserContext): Promise<void>;
  reorderStages(request: ReorderStagesRequest, loggedUserContext: LoggedUserContext): Promise<void>;
  deleteStage(request: DeleteStageRequest, loggedUserContext: LoggedUserContext): Promise<void>;
  listStageCards(request: StageCardsRequest, loggedUserContext: LoggedUserContext): Promise<StageCardsPage>;
  addCard(request: AddCardRequest, loggedUserContext: LoggedUserContext): Promise<void>;
  moveCard(request: MoveCardRequest, loggedUserContext: LoggedUserContext): Promise<void>;
  removeCard(request: RemoveCardRequest, loggedUserContext: LoggedUserContext): Promise<void>;
}

const MANAGING_ACCESS_LEVELS: PipelineAccess['level'][] = ['admin', 'owner'];

export class PipelineService implements IPipelineService {
  constructor(
    private readonly pipelineRepository: IPipelineRepository,
    private readonly cardRepository: IPipelineCardRepository,
    private readonly leadRepository: ILeadRepository,
    private readonly notifications: INotificationService,
    private readonly pipelineChanges: IPipelineChangeAnnouncer,
    private readonly audit: IAuditService,
    private readonly clock: Clock,
  ) {}

  async listPipelines(loggedUserContext: LoggedUserContext): Promise<PipelineOutput[]> {
    const viewer = this.viewerOf(loggedUserContext);
    const pipelines = await this.pipelineRepository.findPipelinesVisibleTo(viewer);
    return pipelines.map((pipeline) => ({ ...pipeline, canManage: viewer.isAdmin || pipeline.owner.id === viewer.userId }));
  }

  async createPipeline({ name, ownerId }: CreatePipelineInput, loggedUserContext: LoggedUserContext): Promise<void> {
    const { loggedUser } = loggedUserContext;
    const chosenOwnerId = ownerId ?? loggedUser.id;
    if (chosenOwnerId !== loggedUser.id && loggedUser.role !== Role.ADMIN) {
      throw new ForbiddenError(PIPELINE_ERRORS.ONLY_ADMIN_CHOOSES_OWNER);
    }
    if (!(await this.pipelineRepository.isActiveUser(chosenOwnerId, null))) throw new BadRequestError(PIPELINE_ERRORS.OWNER_NOT_AVAILABLE);

    const createdPipelineId = await this.pipelineRepository.createPipeline(name, chosenOwnerId);
    await this.recordPipelineAuditLog(loggedUserContext, 'pipeline.create', createdPipelineId, { name, ownerId: chosenOwnerId });
  }

  async renamePipeline({ targetPipelineId, name }: RenamePipelineRequest, loggedUserContext: LoggedUserContext): Promise<void> {
    await this.findManagingAccessOrFail(targetPipelineId, loggedUserContext);
    await this.pipelineRepository.renamePipeline(targetPipelineId, name);
    await this.recordPipelineAuditLog(loggedUserContext, 'pipeline.rename', targetPipelineId, { name });
    await this.pipelineChanges.announce(targetPipelineId);
  }

  async deletePipeline({ targetPipelineId }: PipelineRequest, loggedUserContext: LoggedUserContext): Promise<void> {
    await this.findManagingAccessOrFail(targetPipelineId, loggedUserContext);
    const peopleWithAccess = await this.pipelineChanges.findAudience(targetPipelineId);
    await this.pipelineRepository.deletePipeline(targetPipelineId);
    await this.recordPipelineAuditLog(loggedUserContext, 'pipeline.delete', targetPipelineId, undefined);
    await this.pipelineChanges.announceTo(peopleWithAccess, targetPipelineId);
  }

  async listInvitableUsers({ targetPipelineId }: PipelineRequest, loggedUserContext: LoggedUserContext): Promise<PipelinePersonOutput[]> {
    await this.findManagingAccessOrFail(targetPipelineId, loggedUserContext);
    return await this.pipelineRepository.findInvitableUsers(targetPipelineId);
  }

  async addMember({ targetPipelineId, targetUserId }: PipelineMemberRequest, loggedUserContext: LoggedUserContext): Promise<void> {
    const access = await this.findManagingAccessOrFail(targetPipelineId, loggedUserContext);
    if (targetUserId === access.ownerId) throw new BadRequestError(PIPELINE_ERRORS.OWNER_ALREADY_HAS_ACCESS);
    if (!(await this.pipelineRepository.isActiveUser(targetUserId, Role.AGENT))) {
      throw new BadRequestError(PIPELINE_ERRORS.MEMBER_NOT_AVAILABLE);
    }

    await this.pipelineRepository.addMember(targetPipelineId, targetUserId, loggedUserContext.loggedUser.id);
    await this.recordPipelineAuditLog(loggedUserContext, 'pipeline.member_add', targetPipelineId, { userId: targetUserId });
    await this.notifyNewMember(targetPipelineId, targetUserId);
    await this.pipelineChanges.announce(targetPipelineId);
  }

  async removeMember({ targetPipelineId, targetUserId }: PipelineMemberRequest, loggedUserContext: LoggedUserContext): Promise<void> {
    const access = await this.findAccessOrFail(targetPipelineId, loggedUserContext);
    const isLeaving = targetUserId === loggedUserContext.loggedUser.id;
    if (!isLeaving) this.assertCanManage(access);
    const peopleWithAccess = await this.pipelineChanges.findAudience(targetPipelineId);

    const wasRemoved = await this.pipelineRepository.removeMember(targetPipelineId, targetUserId);
    if (!wasRemoved) throw new NotFoundError(PIPELINE_ERRORS.MEMBER_NOT_FOUND);
    await this.recordPipelineAuditLog(loggedUserContext, 'pipeline.member_remove', targetPipelineId, { userId: targetUserId });
    await this.pipelineChanges.announceTo(peopleWithAccess, targetPipelineId);
  }

  async createStage({ targetPipelineId, stage }: CreateStageRequest, loggedUserContext: LoggedUserContext): Promise<void> {
    await this.findAccessOrFail(targetPipelineId, loggedUserContext);
    const stageIds = await this.pipelineRepository.findStageIds(targetPipelineId);
    if (stageIds.length >= MAXIMUM_STAGES_PER_PIPELINE) throw new BadRequestError(PIPELINE_ERRORS.TOO_MANY_STAGES);
    await this.pipelineRepository.createStage(targetPipelineId, stage);
    await this.pipelineChanges.announce(targetPipelineId);
  }

  async updateStage(
    { targetPipelineId, targetStageId, stageChanges }: UpdateStageRequest,
    loggedUserContext: LoggedUserContext,
  ): Promise<void> {
    await this.findAccessOrFail(targetPipelineId, loggedUserContext);
    await this.findStageOfPipelineOrFail(targetPipelineId, targetStageId);
    await this.pipelineRepository.updateStage(targetStageId, {
      ...stageChanges,
      ...(stageChanges.isWon === true && { isLost: false }),
      ...(stageChanges.isLost === true && { isWon: false }),
    });
    await this.pipelineChanges.announce(targetPipelineId);
  }

  async reorderStages({ targetPipelineId, stageIds }: ReorderStagesRequest, loggedUserContext: LoggedUserContext): Promise<void> {
    await this.findAccessOrFail(targetPipelineId, loggedUserContext);
    const currentStageIds = await this.pipelineRepository.findStageIds(targetPipelineId);
    const isSameSetOfStages =
      stageIds.length === currentStageIds.length &&
      new Set(stageIds).size === stageIds.length &&
      stageIds.every((stageId) => currentStageIds.includes(stageId));
    if (!isSameSetOfStages) throw new BadRequestError(PIPELINE_ERRORS.STAGE_ORDER_INVALID);

    await this.pipelineRepository.reorderStages(stageIds);
    await this.pipelineChanges.announce(targetPipelineId);
  }

  async deleteStage(
    { targetPipelineId, targetStageId, moveCardsToStageId }: DeleteStageRequest,
    loggedUserContext: LoggedUserContext,
  ): Promise<void> {
    await this.findAccessOrFail(targetPipelineId, loggedUserContext);
    await this.findStageOfPipelineOrFail(targetPipelineId, targetStageId);
    const stageIds = await this.pipelineRepository.findStageIds(targetPipelineId);
    if (stageIds.length <= 1) throw new BadRequestError(PIPELINE_ERRORS.LAST_STAGE);
    if (moveCardsToStageId === targetStageId || !stageIds.includes(moveCardsToStageId)) {
      throw new BadRequestError(PIPELINE_ERRORS.RECEIVING_STAGE_INVALID);
    }

    await this.pipelineRepository.deleteStageMovingCards(targetStageId, moveCardsToStageId);
    await this.recordPipelineAuditLog(loggedUserContext, 'pipeline.stage_delete', targetPipelineId, {
      stageId: targetStageId,
      cardsMovedToStageId: moveCardsToStageId,
    });
    await this.pipelineChanges.announce(targetPipelineId);
  }

  async listStageCards({ targetPipelineId, targetStageId, query }: StageCardsRequest, loggedUserContext: LoggedUserContext): Promise<StageCardsPage> {
    await this.findAccessOrFail(targetPipelineId, loggedUserContext);
    await this.findStageOfPipelineOrFail(targetPipelineId, targetStageId);
    return await this.cardRepository.findStageCardsPage(targetStageId, query);
  }

  async addCard({ targetPipelineId, card }: AddCardRequest, loggedUserContext: LoggedUserContext): Promise<void> {
    await this.findAccessOrFail(targetPipelineId, loggedUserContext);
    await this.findStageOfPipelineOrFail(targetPipelineId, card.stageId);
    if (!(await this.leadRepository.findLeadById(card.leadId))) throw new NotFoundError(LEAD_ERRORS.NOT_FOUND);

    await this.cardRepository.addCardOnTop({
      pipelineId: targetPipelineId,
      stageId: card.stageId,
      leadId: card.leadId,
      addedById: loggedUserContext.loggedUser.id,
    });
    await this.recordPipelineAuditLog(loggedUserContext, 'pipeline.card_add', targetPipelineId, { leadId: card.leadId, stageId: card.stageId });
    await this.pipelineChanges.announce(targetPipelineId);
  }

  async moveCard({ targetPipelineId, targetCardId, move }: MoveCardRequest, loggedUserContext: LoggedUserContext): Promise<void> {
    await this.findAccessOrFail(targetPipelineId, loggedUserContext);
    const card = await this.findCardOfPipelineOrFail(targetPipelineId, targetCardId);
    const destinationStage = await this.findStageOfPipelineOrFail(targetPipelineId, move.stageId);
    await this.assertPreviousCardIsInDestination(targetPipelineId, move, targetCardId);
    const changesStage = destinationStage.id !== card.stageId;

    await this.cardRepository.moveCard(targetCardId, {
      stageId: destinationStage.id,
      previousCardId: move.previousCardId,
      closing: changesStage ? this.decideClosing(destinationStage, move) : undefined,
    });
    if (changesStage) {
      await this.recordPipelineAuditLog(loggedUserContext, 'pipeline.card_move', targetPipelineId, {
        leadId: card.leadId,
        fromStageId: card.stageId,
        toStageId: destinationStage.id,
      });
    }
    await this.pipelineChanges.announce(targetPipelineId);
  }

  async removeCard({ targetPipelineId, targetCardId }: RemoveCardRequest, loggedUserContext: LoggedUserContext): Promise<void> {
    await this.findAccessOrFail(targetPipelineId, loggedUserContext);
    const card = await this.findCardOfPipelineOrFail(targetPipelineId, targetCardId);
    await this.cardRepository.removeCard(targetCardId);
    await this.recordPipelineAuditLog(loggedUserContext, 'pipeline.card_remove', targetPipelineId, { leadId: card.leadId });
    await this.pipelineChanges.announce(targetPipelineId);
  }

  private decideClosing(destinationStage: StageRecord, { wonValue, closingNote }: MoveCardInput): CardClosing {
    if (destinationStage.isWon) {
      if (wonValue === null) throw new BadRequestError(PIPELINE_ERRORS.WON_VALUE_REQUIRED);
      return { wonValue, closingNote, closedAt: this.clock.now() };
    }
    if (destinationStage.isLost) return { wonValue: null, closingNote, closedAt: this.clock.now() };
    return { wonValue: null, closingNote: null, closedAt: null };
  }

  private async assertPreviousCardIsInDestination(pipelineId: string, move: MoveCardInput, movingCardId: string): Promise<void> {
    if (move.previousCardId === null) return;
    const previousCard = await this.cardRepository.findCard(move.previousCardId);
    const isValidReference =
      previousCard !== null &&
      previousCard.pipelineId === pipelineId &&
      previousCard.stageId === move.stageId &&
      previousCard.id !== movingCardId;
    if (!isValidReference) throw new BadRequestError(PIPELINE_ERRORS.PREVIOUS_CARD_INVALID);
  }

  private viewerOf({ loggedUser }: LoggedUserContext): PipelineViewer {
    return { userId: loggedUser.id, isAdmin: loggedUser.role === Role.ADMIN };
  }

  private async findAccessOrFail(pipelineId: string, loggedUserContext: LoggedUserContext): Promise<PipelineAccess> {
    const access = await this.pipelineRepository.findPipelineAccess(pipelineId, this.viewerOf(loggedUserContext));
    if (!access) throw new NotFoundError(PIPELINE_ERRORS.NOT_FOUND);
    return access;
  }

  private async findManagingAccessOrFail(pipelineId: string, loggedUserContext: LoggedUserContext): Promise<PipelineAccess> {
    const access = await this.findAccessOrFail(pipelineId, loggedUserContext);
    this.assertCanManage(access);
    return access;
  }

  private assertCanManage(access: PipelineAccess): void {
    if (!MANAGING_ACCESS_LEVELS.includes(access.level)) throw new ForbiddenError(PIPELINE_ERRORS.ONLY_MANAGER);
  }

  private async findStageOfPipelineOrFail(pipelineId: string, stageId: string): Promise<StageRecord> {
    const stage = await this.pipelineRepository.findStage(stageId);
    if (!stage || stage.pipelineId !== pipelineId) throw new NotFoundError(PIPELINE_ERRORS.STAGE_NOT_FOUND);
    return stage;
  }

  private async findCardOfPipelineOrFail(pipelineId: string, cardId: string): Promise<PipelineCardRecord> {
    const card = await this.cardRepository.findCard(cardId);
    if (!card || card.pipelineId !== pipelineId) throw new NotFoundError(PIPELINE_ERRORS.CARD_NOT_FOUND);
    return card;
  }

  private async notifyNewMember(pipelineId: string, memberId: string): Promise<void> {
    const pipeline = await this.pipelineRepository.findPipelineDetails(pipelineId);
    if (!pipeline) return;
    const { title, message } = PIPELINE_NOTIFICATION_MESSAGES.MEMBER_ADDED;
    await this.notifications.notifyUser(memberId, {
      type: NotificationType.PIPELINE_MEMBER_ADDED,
      title,
      message: message(pipeline.name),
      actionUrl: `/kanban?funil=${pipelineId}`,
    });
  }

  private async recordPipelineAuditLog(
    loggedUserContext: LoggedUserContext,
    action: string,
    pipelineId: string,
    details: AuditLogInput['details'],
  ): Promise<void> {
    await this.audit.recordAuditLog(loggedUserContext, { action, entity: 'Pipeline', entityId: pipelineId, details });
  }
}
