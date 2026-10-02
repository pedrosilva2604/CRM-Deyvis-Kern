import { Router } from 'express';
import type { PipelineController } from '@/controllers/pipeline.controller';
import {
  addCardSchema,
  addPipelineMemberSchema,
  createPipelineSchema,
  createStageSchema,
  deleteStageQuerySchema,
  moveCardSchema,
  pipelineCardParamsSchema,
  pipelineIdParamsSchema,
  pipelineMemberParamsSchema,
  pipelineStageParamsSchema,
  renamePipelineSchema,
  reorderStagesSchema,
  stageCardsQuerySchema,
  updateStageSchema,
} from '@/middlewares/schemas/pipeline.schema';
import type { ValidationMiddleware } from '@/middlewares/validation.middleware';

export class PipelineRoutes {
  readonly router = Router();

  constructor(
    private readonly pipelines: PipelineController,
    private readonly validate: ValidationMiddleware,
  ) {
    this.registerPipelineRoutes();
    this.registerMemberRoutes();
    this.registerStageRoutes();
    this.registerCardRoutes();
  }

  private registerPipelineRoutes() {
    this.router.get('/', this.pipelines.listPipelines);
    this.router.post('/', this.validate.validateBody(createPipelineSchema), this.pipelines.createPipeline);
    this.router.patch(
      '/:pipelineId',
      this.validate.validateParams(pipelineIdParamsSchema),
      this.validate.validateBody(renamePipelineSchema),
      this.pipelines.renamePipeline,
    );
    this.router.delete('/:pipelineId', this.validate.validateParams(pipelineIdParamsSchema), this.pipelines.deletePipeline);
  }

  private registerMemberRoutes() {
    this.router.get(
      '/:pipelineId/invitable-users',
      this.validate.validateParams(pipelineIdParamsSchema),
      this.pipelines.listInvitableUsers,
    );
    this.router.post(
      '/:pipelineId/members',
      this.validate.validateParams(pipelineIdParamsSchema),
      this.validate.validateBody(addPipelineMemberSchema),
      this.pipelines.addMember,
    );
    this.router.delete(
      '/:pipelineId/members/:userId',
      this.validate.validateParams(pipelineMemberParamsSchema),
      this.pipelines.removeMember,
    );
  }

  private registerStageRoutes() {
    this.router.post(
      '/:pipelineId/stages',
      this.validate.validateParams(pipelineIdParamsSchema),
      this.validate.validateBody(createStageSchema),
      this.pipelines.createStage,
    );
    this.router.put(
      '/:pipelineId/stages/order',
      this.validate.validateParams(pipelineIdParamsSchema),
      this.validate.validateBody(reorderStagesSchema),
      this.pipelines.reorderStages,
    );
    this.router.patch(
      '/:pipelineId/stages/:stageId',
      this.validate.validateParams(pipelineStageParamsSchema),
      this.validate.validateBody(updateStageSchema),
      this.pipelines.updateStage,
    );
    this.router.delete(
      '/:pipelineId/stages/:stageId',
      this.validate.validateParams(pipelineStageParamsSchema),
      this.validate.validateQuery(deleteStageQuerySchema),
      this.pipelines.deleteStage,
    );
    this.router.get(
      '/:pipelineId/stages/:stageId/cards',
      this.validate.validateParams(pipelineStageParamsSchema),
      this.validate.validateQuery(stageCardsQuerySchema),
      this.pipelines.listStageCards,
    );
  }

  private registerCardRoutes() {
    this.router.post(
      '/:pipelineId/cards',
      this.validate.validateParams(pipelineIdParamsSchema),
      this.validate.validateBody(addCardSchema),
      this.pipelines.addCard,
    );
    this.router.patch(
      '/:pipelineId/cards/:cardId/move',
      this.validate.validateParams(pipelineCardParamsSchema),
      this.validate.validateBody(moveCardSchema),
      this.pipelines.moveCard,
    );
    this.router.delete(
      '/:pipelineId/cards/:cardId',
      this.validate.validateParams(pipelineCardParamsSchema),
      this.pipelines.removeCard,
    );
  }
}
