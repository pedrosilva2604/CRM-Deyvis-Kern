import { Prisma, Role } from '@prisma/client';
import { DEFAULT_PIPELINE_STAGES } from '@/constants/default-pipeline';
import { MAXIMUM_STAGES_PER_PIPELINE } from '@/constants/pipeline-limits';
import {
  pipelineOutputRelations,
  toPipelineDetails,
  type PipelineAccess,
  type PipelineDetails,
  type PipelinePersonOutput,
  type StageInput,
  type StageRecord,
  type UpdateStageInput,
} from '@/models/pipeline.model';
import type { DatabaseClient, DatabaseTransaction } from '@/repositories/database-client';
import { CARD_POSITION_GAP, lockStagesForCardPlacement } from '@/repositories/pipeline-card.repository';
import { lockAvailableUser } from '@/repositories/user-locks';

export interface PipelineViewer {
  userId: string;
  isAdmin: boolean;
}

export interface IPipelineRepository {
  findPipelinesVisibleTo(viewer: PipelineViewer): Promise<PipelineDetails[]>;
  findPipelineDetails(pipelineId: string): Promise<PipelineDetails | null>;
  findPipelineAccess(pipelineId: string, viewer: PipelineViewer): Promise<PipelineAccess | null>;
  findPeopleWithAccess(pipelineId: string): Promise<string[]>;
  findInvitableUsers(pipelineId: string): Promise<PipelinePersonOutput[]>;
  createPipeline(name: string, ownerId: string): Promise<string | null>;
  renamePipeline(pipelineId: string, name: string): Promise<void>;
  deletePipeline(pipelineId: string): Promise<void>;
  addMember(pipelineId: string, userId: string, addedById: string): Promise<MemberAdditionOutcome>;
  removeMember(pipelineId: string, userId: string): Promise<boolean>;
  findStage(stageId: string): Promise<StageRecord | null>;
  findStageIds(pipelineId: string): Promise<string[]>;
  createStage(pipelineId: string, stage: StageInput): Promise<StageCreationOutcome>;
  updateStage(stageId: string, stageChanges: UpdateStageInput): Promise<StageUpdateOutcome>;
  reorderStages(pipelineId: string, orderedStageIds: string[]): Promise<StageReorderOutcome>;
  deleteStageMovingCards(pipelineId: string, stageId: string, receivingStageId: string): Promise<StageDeletionOutcome>;
}

export type StageCreationOutcome = 'created' | 'pipelineNotFound' | 'tooManyStages';
export type MemberAdditionOutcome = 'added' | 'memberNotAvailable' | 'pipelineNotFound';
export type StageUpdateOutcome = 'updated' | 'stageNotFound' | 'cardsWithoutWonValue';
export type StageReorderOutcome = 'reordered' | 'pipelineNotFound' | 'stageOrderInvalid';
export type StageDeletionOutcome = 'deleted' | 'pipelineNotFound' | 'stageNotFound' | 'lastStage' | 'cardsWithoutWonValue';

interface StageClosingKind {
  id: string;
  isWon: boolean;
  isLost: boolean;
}

const STAGE_POSITION_GAP = 1;

function isSameSetOfStages(orderedStageIds: string[], currentStageIds: string[]): boolean {
  return (
    orderedStageIds.length === currentStageIds.length &&
    new Set(orderedStageIds).size === orderedStageIds.length &&
    orderedStageIds.every((stageId) => currentStageIds.includes(stageId))
  );
}

export class PipelineRepository implements IPipelineRepository {
  constructor(private readonly prisma: DatabaseClient) {}

  async findPipelinesVisibleTo({ userId, isAdmin }: PipelineViewer): Promise<PipelineDetails[]> {
    const pipelines = await this.prisma.pipeline.findMany({
      where: isAdmin ? {} : { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
      include: pipelineOutputRelations,
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return pipelines.map(toPipelineDetails);
  }

  async findPipelineDetails(pipelineId: string): Promise<PipelineDetails | null> {
    const pipeline = await this.prisma.pipeline.findUnique({ where: { id: pipelineId }, include: pipelineOutputRelations });
    return pipeline ? toPipelineDetails(pipeline) : null;
  }

  async findPipelineAccess(pipelineId: string, { userId, isAdmin }: PipelineViewer): Promise<PipelineAccess | null> {
    const pipeline = await this.prisma.pipeline.findUnique({
      where: { id: pipelineId },
      select: { id: true, ownerId: true, members: { where: { userId }, select: { userId: true } } },
    });
    if (!pipeline) return null;
    if (isAdmin) return { pipelineId: pipeline.id, ownerId: pipeline.ownerId, level: 'admin' };
    if (pipeline.ownerId === userId) return { pipelineId: pipeline.id, ownerId: pipeline.ownerId, level: 'owner' };
    if (pipeline.members.length > 0) return { pipelineId: pipeline.id, ownerId: pipeline.ownerId, level: 'member' };
    return null;
  }

  async findPeopleWithAccess(pipelineId: string): Promise<string[]> {
    const people = await this.prisma.user.findMany({
      where: {
        active: true,
        deletedAt: null,
        OR: [
          { role: Role.ADMIN },
          { ownedPipelines: { some: { id: pipelineId } } },
          { pipelineMemberships: { some: { pipelineId } } },
        ],
      },
      select: { id: true },
    });
    return people.map(({ id }) => id);
  }

  async findInvitableUsers(pipelineId: string): Promise<PipelinePersonOutput[]> {
    return await this.prisma.user.findMany({
      where: {
        active: true,
        deletedAt: null,
        role: Role.AGENT,
        ownedPipelines: { none: { id: pipelineId } },
        pipelineMemberships: { none: { pipelineId } },
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async createPipeline(name: string, ownerId: string): Promise<string | null> {
    return await this.prisma.$transaction(async (transaction) => {
      if (!(await lockAvailableUser(transaction, ownerId, null))) return null;
      const createdPipeline = await transaction.pipeline.create({
        data: { name, ownerId, stages: { create: DEFAULT_PIPELINE_STAGES } },
        select: { id: true },
      });
      return createdPipeline.id;
    });
  }

  async renamePipeline(pipelineId: string, name: string): Promise<void> {
    await this.prisma.pipeline.update({ where: { id: pipelineId }, data: { name } });
  }

  async deletePipeline(pipelineId: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await this.lockStagesStructureOf(transaction, pipelineId);
      await lockStagesForCardPlacement(transaction, await this.findStageIdsInside(transaction, pipelineId));
      await transaction.pipelineCard.deleteMany({ where: { pipelineId } });
      await transaction.pipeline.delete({ where: { id: pipelineId } });
    });
  }

  async addMember(pipelineId: string, userId: string, addedById: string): Promise<MemberAdditionOutcome> {
    return await this.prisma.$transaction(async (transaction) => {
      if (!(await lockAvailableUser(transaction, userId, Role.AGENT))) return 'memberNotAvailable';
      if (!(await this.lockPipelineAgainstDeletion(transaction, pipelineId))) return 'pipelineNotFound';
      await transaction.pipelineMember.create({ data: { pipelineId, userId, addedById } });
      return 'added';
    });
  }

  async removeMember(pipelineId: string, userId: string): Promise<boolean> {
    const removal = await this.prisma.pipelineMember.deleteMany({ where: { pipelineId, userId } });
    return removal.count === 1;
  }

  async findStage(stageId: string): Promise<StageRecord | null> {
    return await this.prisma.stage.findUnique({
      where: { id: stageId },
      select: { id: true, pipelineId: true, isWon: true, isLost: true },
    });
  }

  async findStageIds(pipelineId: string): Promise<string[]> {
    const stages = await this.prisma.stage.findMany({ where: { pipelineId }, select: { id: true }, orderBy: { position: 'asc' } });
    return stages.map(({ id }) => id);
  }

  async createStage(pipelineId: string, stage: StageInput): Promise<StageCreationOutcome> {
    return await this.prisma.$transaction(async (transaction) => {
      if (!(await this.lockStagesStructureOf(transaction, pipelineId))) return 'pipelineNotFound';
      const currentStageIds = await this.findStageIdsInside(transaction, pipelineId);
      if (currentStageIds.length >= MAXIMUM_STAGES_PER_PIPELINE) return 'tooManyStages';

      const lastStage = await transaction.stage.findFirst({ where: { pipelineId }, orderBy: { position: 'desc' } });
      const position = lastStage ? lastStage.position + STAGE_POSITION_GAP : 0;
      await transaction.stage.create({ data: { pipelineId, position, ...stage } });
      return 'created';
    });
  }

  async updateStage(stageId: string, stageChanges: UpdateStageInput): Promise<StageUpdateOutcome> {
    return await this.prisma.$transaction(async (transaction) => {
      const lockedStageIds = await lockStagesForCardPlacement(transaction, [stageId]);
      if (lockedStageIds.length === 0) return 'stageNotFound';
      const currentKind = await transaction.stage.findUniqueOrThrow({ where: { id: stageId }, select: { id: true, isWon: true, isLost: true } });
      const changedKind = {
        id: stageId,
        isWon: stageChanges.isWon ?? currentKind.isWon,
        isLost: stageChanges.isLost ?? currentKind.isLost,
      };
      const becomesWon = changedKind.isWon && !currentKind.isWon;
      if (becomesWon && (await this.hasCardsWithoutWonValue(transaction, stageId))) return 'cardsWithoutWonValue';

      await transaction.stage.update({ where: { id: stageId }, data: stageChanges });
      if (changedKind.isWon !== currentKind.isWon || changedKind.isLost !== currentKind.isLost) {
        await transaction.$executeRaw`
          UPDATE "PipelineCard" SET "updatedAt" = now()${this.closingChangesFor(currentKind, changedKind)}
          WHERE "stageId" = ${stageId}::uuid`;
      }
      return 'updated';
    });
  }

  async reorderStages(pipelineId: string, orderedStageIds: string[]): Promise<StageReorderOutcome> {
    return await this.prisma.$transaction(async (transaction) => {
      if (!(await this.lockStagesStructureOf(transaction, pipelineId))) return 'pipelineNotFound';
      const currentStageIds = await this.findStageIdsInside(transaction, pipelineId);
      if (!isSameSetOfStages(orderedStageIds, currentStageIds)) return 'stageOrderInvalid';

      for (const [position, stageId] of orderedStageIds.entries()) {
        await transaction.stage.update({ where: { id: stageId }, data: { position } });
      }
      return 'reordered';
    });
  }

  async deleteStageMovingCards(pipelineId: string, stageId: string, receivingStageId: string): Promise<StageDeletionOutcome> {
    return await this.prisma.$transaction(async (transaction) => {
      if (!(await this.lockStagesStructureOf(transaction, pipelineId))) return 'pipelineNotFound';
      const currentStageIds = await this.findStageIdsInside(transaction, pipelineId);
      if (!currentStageIds.includes(stageId) || !currentStageIds.includes(receivingStageId)) return 'stageNotFound';
      if (currentStageIds.length <= 1) return 'lastStage';
      await lockStagesForCardPlacement(transaction, [stageId, receivingStageId]);
      const [deletedStage, receivingStage] = await this.findClosingKindsOf(transaction, stageId, receivingStageId);
      if (receivingStage.isWon && (await this.hasCardsWithoutWonValue(transaction, stageId))) return 'cardsWithoutWonValue';

      await this.appendCardsToStage(transaction, deletedStage, receivingStage);
      await transaction.stage.delete({ where: { id: stageId } });
      return 'deleted';
    });
  }

  private async findClosingKindsOf(
    transaction: DatabaseTransaction,
    stageId: string,
    receivingStageId: string,
  ): Promise<[StageClosingKind, StageClosingKind]> {
    const stages = await transaction.stage.findMany({
      where: { id: { in: [stageId, receivingStageId] } },
      select: { id: true, isWon: true, isLost: true },
    });
    const findStage = (id: string) => stages.find((stage) => stage.id === id)!;
    return [findStage(stageId), findStage(receivingStageId)];
  }

  private async hasCardsWithoutWonValue(transaction: DatabaseTransaction, stageId: string): Promise<boolean> {
    return (await transaction.pipelineCard.count({ where: { stageId, wonValue: null } })) > 0;
  }

  private async lockStagesStructureOf(transaction: DatabaseTransaction, pipelineId: string): Promise<boolean> {
    const lockedPipelines = await transaction.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Pipeline" WHERE "id" = ${pipelineId}::uuid FOR NO KEY UPDATE`;
    return lockedPipelines.length === 1;
  }

  private async lockPipelineAgainstDeletion(transaction: DatabaseTransaction, pipelineId: string): Promise<boolean> {
    const lockedPipelines = await transaction.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Pipeline" WHERE "id" = ${pipelineId}::uuid FOR KEY SHARE`;
    return lockedPipelines.length === 1;
  }

  private async findStageIdsInside(transaction: DatabaseTransaction, pipelineId: string): Promise<string[]> {
    const stages = await transaction.stage.findMany({ where: { pipelineId }, select: { id: true } });
    return stages.map(({ id }) => id);
  }

  private async appendCardsToStage(transaction: DatabaseTransaction, fromStage: StageClosingKind, toStage: StageClosingKind): Promise<void> {
    const lastCard = await transaction.pipelineCard.findFirst({ where: { stageId: toStage.id }, orderBy: { position: 'desc' } });
    const lastPosition = lastCard?.position ?? 0;
    await transaction.$executeRaw`
      UPDATE "PipelineCard" AS card
      SET "stageId" = ${toStage.id}::uuid, "position" = ${lastPosition} + ${CARD_POSITION_GAP} * ordered."rowNumber", "updatedAt" = now()${this.closingChangesFor(fromStage, toStage)}
      FROM (
        SELECT "id", ROW_NUMBER() OVER (ORDER BY "position" ASC, "id" ASC) AS "rowNumber"
        FROM "PipelineCard" WHERE "stageId" = ${fromStage.id}::uuid
      ) AS ordered
      WHERE card."id" = ordered."id"`;
  }

  private closingChangesFor(fromStage: StageClosingKind, toStage: StageClosingKind): Prisma.Sql {
    if (toStage.isWon) return fromStage.isWon ? Prisma.empty : Prisma.sql`, "closedAt" = now()`;
    if (toStage.isLost) {
      return fromStage.isLost ? Prisma.sql`, "wonValue" = NULL` : Prisma.sql`, "wonValue" = NULL, "closedAt" = now()`;
    }
    return Prisma.sql`, "wonValue" = NULL, "closingNote" = NULL, "closedAt" = NULL`;
  }
}
