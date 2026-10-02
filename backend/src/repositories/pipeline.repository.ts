import { Role } from '@prisma/client';
import { DEFAULT_PIPELINE_STAGES } from '@/constants/default-pipeline';
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
import { CARD_POSITION_GAP } from '@/repositories/pipeline-card.repository';

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
  isActiveUser(userId: string, role: Role | null): Promise<boolean>;
  createPipeline(name: string, ownerId: string): Promise<string>;
  renamePipeline(pipelineId: string, name: string): Promise<void>;
  deletePipeline(pipelineId: string): Promise<void>;
  addMember(pipelineId: string, userId: string, addedById: string): Promise<void>;
  removeMember(pipelineId: string, userId: string): Promise<boolean>;
  findStage(stageId: string): Promise<StageRecord | null>;
  findStageIds(pipelineId: string): Promise<string[]>;
  createStage(pipelineId: string, stage: StageInput): Promise<void>;
  updateStage(stageId: string, stageChanges: UpdateStageInput): Promise<void>;
  reorderStages(orderedStageIds: string[]): Promise<void>;
  deleteStageMovingCards(stageId: string, receivingStageId: string): Promise<void>;
}

const STAGE_POSITION_GAP = 1;

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
        role: Role.AGENT,
        ownedPipelines: { none: { id: pipelineId } },
        pipelineMemberships: { none: { pipelineId } },
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async isActiveUser(userId: string, role: Role | null): Promise<boolean> {
    return (await this.prisma.user.count({ where: { id: userId, active: true, ...(role !== null && { role }) } })) > 0;
  }

  async createPipeline(name: string, ownerId: string): Promise<string> {
    const createdPipeline = await this.prisma.pipeline.create({
      data: { name, ownerId, stages: { create: DEFAULT_PIPELINE_STAGES } },
      select: { id: true },
    });
    return createdPipeline.id;
  }

  async renamePipeline(pipelineId: string, name: string): Promise<void> {
    await this.prisma.pipeline.update({ where: { id: pipelineId }, data: { name } });
  }

  async deletePipeline(pipelineId: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.pipelineCard.deleteMany({ where: { pipelineId } });
      await transaction.pipeline.delete({ where: { id: pipelineId } });
    });
  }

  async addMember(pipelineId: string, userId: string, addedById: string): Promise<void> {
    await this.prisma.pipelineMember.create({ data: { pipelineId, userId, addedById } });
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

  async createStage(pipelineId: string, stage: StageInput): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const lastStage = await transaction.stage.findFirst({ where: { pipelineId }, orderBy: { position: 'desc' } });
      const position = lastStage ? lastStage.position + STAGE_POSITION_GAP : 0;
      await transaction.stage.create({ data: { pipelineId, position, ...stage } });
    });
  }

  async updateStage(stageId: string, stageChanges: UpdateStageInput): Promise<void> {
    await this.prisma.stage.update({ where: { id: stageId }, data: stageChanges });
  }

  async reorderStages(orderedStageIds: string[]): Promise<void> {
    await this.prisma.$transaction(
      orderedStageIds.map((stageId, position) => this.prisma.stage.update({ where: { id: stageId }, data: { position } })),
    );
  }

  async deleteStageMovingCards(stageId: string, receivingStageId: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await this.appendCardsToStage(transaction, stageId, receivingStageId);
      await transaction.stage.delete({ where: { id: stageId } });
    });
  }

  private async appendCardsToStage(transaction: DatabaseTransaction, fromStageId: string, toStageId: string): Promise<void> {
    const lastCard = await transaction.pipelineCard.findFirst({ where: { stageId: toStageId }, orderBy: { position: 'desc' } });
    const lastPosition = lastCard?.position ?? 0;
    await transaction.$executeRaw`
      UPDATE "PipelineCard" AS card
      SET "stageId" = ${toStageId}::uuid, "position" = ${lastPosition} + ${CARD_POSITION_GAP} * ordered."rowNumber", "updatedAt" = now()
      FROM (
        SELECT "id", ROW_NUMBER() OVER (ORDER BY "position" ASC, "id" ASC) AS "rowNumber"
        FROM "PipelineCard" WHERE "stageId" = ${fromStageId}::uuid
      ) AS ordered
      WHERE card."id" = ordered."id"`;
  }
}
