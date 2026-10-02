import type { LeadContactStatus, Prisma } from '@prisma/client';

export interface PipelinePersonOutput {
  id: string;
  name: string;
}

export interface PipelineStageOutput {
  id: string;
  name: string;
  color: string;
  position: number;
  isWon: boolean;
  isLost: boolean;
}

export interface PipelineDetails {
  id: string;
  name: string;
  owner: PipelinePersonOutput;
  members: PipelinePersonOutput[];
  stages: PipelineStageOutput[];
}

export interface PipelineOutput extends PipelineDetails {
  canManage: boolean;
}

export interface PipelineCardLeadOutput {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  contactStatus: LeadContactStatus;
  assignedTo: PipelinePersonOutput | null;
  unreadCount: number;
  lastMessageAt: Date | null;
}

export interface PipelineCardOutput {
  id: string;
  stageId: string;
  position: number;
  wonValue: string | null;
  closingNote: string | null;
  closedAt: Date | null;
  lead: PipelineCardLeadOutput;
}

export interface StageCardsPage {
  stageId: string;
  cards: PipelineCardOutput[];
  totalCards: number;
  nextAfterPosition: number | null;
}

export type PipelineAccessLevel = 'admin' | 'owner' | 'member';

export interface PipelineAccess {
  pipelineId: string;
  ownerId: string;
  level: PipelineAccessLevel;
}

export interface StageRecord {
  id: string;
  pipelineId: string;
  isWon: boolean;
  isLost: boolean;
}

export interface PipelineCardRecord {
  id: string;
  pipelineId: string;
  stageId: string;
  leadId: string;
  position: number;
}

export interface CardClosing {
  wonValue: string | null;
  closingNote: string | null;
  closedAt: Date | null;
}

export type PipelineIdParams = { pipelineId: string };
export type PipelineStageParams = { pipelineId: string; stageId: string };
export type PipelineMemberParams = { pipelineId: string; userId: string };
export type PipelineCardParams = { pipelineId: string; cardId: string };

export interface CreatePipelineInput {
  name: string;
  ownerId: string | null;
}

export interface RenamePipelineInput {
  name: string;
}

export interface AddPipelineMemberInput {
  userId: string;
}

export interface StageInput {
  name: string;
  color: string;
  isWon: boolean;
  isLost: boolean;
}

export type UpdateStageInput = Partial<StageInput>;

export interface ReorderStagesInput {
  stageIds: string[];
}

export interface DeleteStageQuery {
  moveCardsToStageId: string;
}

export interface StageCardsQuery {
  afterPosition: number | null;
  limit: number;
}

export interface AddCardInput {
  leadId: string;
  stageId: string;
}

export interface MoveCardInput {
  stageId: string;
  previousCardId: string | null;
  wonValue: string | null;
  closingNote: string | null;
}

export interface PipelineRequest {
  targetPipelineId: string;
}

export interface RenamePipelineRequest extends PipelineRequest {
  name: string;
}

export interface PipelineMemberRequest extends PipelineRequest {
  targetUserId: string;
}

export interface CreateStageRequest extends PipelineRequest {
  stage: StageInput;
}

export interface UpdateStageRequest extends PipelineRequest {
  targetStageId: string;
  stageChanges: UpdateStageInput;
}

export interface ReorderStagesRequest extends PipelineRequest {
  stageIds: string[];
}

export interface DeleteStageRequest extends PipelineRequest {
  targetStageId: string;
  moveCardsToStageId: string;
}

export interface StageCardsRequest extends PipelineRequest {
  targetStageId: string;
  query: StageCardsQuery;
}

export interface AddCardRequest extends PipelineRequest {
  card: AddCardInput;
}

export interface MoveCardRequest extends PipelineRequest {
  targetCardId: string;
  move: MoveCardInput;
}

export interface RemoveCardRequest extends PipelineRequest {
  targetCardId: string;
}

export const pipelineOutputRelations = {
  owner: { select: { id: true, name: true } },
  members: { select: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' } },
  stages: { orderBy: { position: 'asc' } },
} satisfies Prisma.PipelineInclude;

export type PipelineWithRelations = Prisma.PipelineGetPayload<{ include: typeof pipelineOutputRelations }>;

export function toPipelineDetails(pipeline: PipelineWithRelations): PipelineDetails {
  return {
    id: pipeline.id,
    name: pipeline.name,
    owner: pipeline.owner,
    members: pipeline.members.map(({ user }) => user),
    stages: pipeline.stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      color: stage.color,
      position: stage.position,
      isWon: stage.isWon,
      isLost: stage.isLost,
    })),
  };
}

export const pipelineCardOutputRelations = {
  lead: {
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      contactStatus: true,
      unreadCount: true,
      lastMessageAt: true,
      assignedTo: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.PipelineCardInclude;

export type PipelineCardWithRelations = Prisma.PipelineCardGetPayload<{ include: typeof pipelineCardOutputRelations }>;

export function toPipelineCardOutput(card: PipelineCardWithRelations): PipelineCardOutput {
  return {
    id: card.id,
    stageId: card.stageId,
    position: card.position,
    wonValue: card.wonValue === null ? null : card.wonValue.toFixed(2),
    closingNote: card.closingNote,
    closedAt: card.closedAt,
    lead: card.lead,
  };
}
