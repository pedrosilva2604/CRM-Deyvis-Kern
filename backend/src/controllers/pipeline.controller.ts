import type { Request, Response } from 'express';
import { PIPELINE_SUCCESS_MESSAGES } from '@/constants/success-messages';
import { HttpStatus, sendSuccessMessage } from '@/infra/http-status';
import type { RequestContextExtractor } from '@/infra/request-context-extractor';
import { readValidatedQuery } from '@/middlewares/validation.middleware';
import type {
  AddCardInput,
  AddPipelineMemberInput,
  CreatePipelineInput,
  DeleteStageQuery,
  MoveCardInput,
  PipelineCardParams,
  PipelineIdParams,
  PipelineMemberParams,
  PipelineStageParams,
  RenamePipelineInput,
  ReorderStagesInput,
  StageCardsQuery,
  StageInput,
  UpdateStageInput,
} from '@/models/pipeline.model';
import type { IPipelineService } from '@/services/pipeline.service';

export class PipelineController {
  constructor(
    private readonly pipelineService: IPipelineService,
    private readonly requestContextExtractor: RequestContextExtractor,
  ) {}

  listPipelines = async (req: Request, res: Response) => {
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    const pipelines = await this.pipelineService.listPipelines(loggedUserContext);
    res.status(HttpStatus.OK).json(pipelines);
  };

  createPipeline = async (req: Request, res: Response) => {
    const newPipeline: CreatePipelineInput = req.body;
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    await this.pipelineService.createPipeline(newPipeline, loggedUserContext);
    sendSuccessMessage(res, HttpStatus.CREATED, PIPELINE_SUCCESS_MESSAGES.CREATED);
  };

  renamePipeline = async (req: Request<PipelineIdParams>, res: Response) => {
    const { name }: RenamePipelineInput = req.body;
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    await this.pipelineService.renamePipeline({ targetPipelineId: req.params.pipelineId, name }, loggedUserContext);
    sendSuccessMessage(res, HttpStatus.OK, PIPELINE_SUCCESS_MESSAGES.RENAMED);
  };

  deletePipeline = async (req: Request<PipelineIdParams>, res: Response) => {
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    await this.pipelineService.deletePipeline({ targetPipelineId: req.params.pipelineId }, loggedUserContext);
    sendSuccessMessage(res, HttpStatus.OK, PIPELINE_SUCCESS_MESSAGES.DELETED);
  };

  listInvitableUsers = async (req: Request<PipelineIdParams>, res: Response) => {
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    const invitableUsers = await this.pipelineService.listInvitableUsers({ targetPipelineId: req.params.pipelineId }, loggedUserContext);
    res.status(HttpStatus.OK).json(invitableUsers);
  };

  addMember = async (req: Request<PipelineIdParams>, res: Response) => {
    const { userId }: AddPipelineMemberInput = req.body;
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    await this.pipelineService.addMember({ targetPipelineId: req.params.pipelineId, targetUserId: userId }, loggedUserContext);
    sendSuccessMessage(res, HttpStatus.CREATED, PIPELINE_SUCCESS_MESSAGES.MEMBER_ADDED);
  };

  removeMember = async (req: Request<PipelineMemberParams>, res: Response) => {
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    await this.pipelineService.removeMember(
      { targetPipelineId: req.params.pipelineId, targetUserId: req.params.userId },
      loggedUserContext,
    );
    sendSuccessMessage(res, HttpStatus.OK, PIPELINE_SUCCESS_MESSAGES.MEMBER_REMOVED);
  };

  createStage = async (req: Request<PipelineIdParams>, res: Response) => {
    const stage: StageInput = req.body;
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    await this.pipelineService.createStage({ targetPipelineId: req.params.pipelineId, stage }, loggedUserContext);
    sendSuccessMessage(res, HttpStatus.CREATED, PIPELINE_SUCCESS_MESSAGES.STAGE_CREATED);
  };

  updateStage = async (req: Request<PipelineStageParams>, res: Response) => {
    const stageChanges: UpdateStageInput = req.body;
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    await this.pipelineService.updateStage(
      { targetPipelineId: req.params.pipelineId, targetStageId: req.params.stageId, stageChanges },
      loggedUserContext,
    );
    sendSuccessMessage(res, HttpStatus.OK, PIPELINE_SUCCESS_MESSAGES.STAGE_UPDATED);
  };

  reorderStages = async (req: Request<PipelineIdParams>, res: Response) => {
    const { stageIds }: ReorderStagesInput = req.body;
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    await this.pipelineService.reorderStages({ targetPipelineId: req.params.pipelineId, stageIds }, loggedUserContext);
    sendSuccessMessage(res, HttpStatus.OK, PIPELINE_SUCCESS_MESSAGES.STAGES_REORDERED);
  };

  deleteStage = async (req: Request<PipelineStageParams>, res: Response) => {
    const { moveCardsToStageId } = readValidatedQuery<DeleteStageQuery>(res);
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    await this.pipelineService.deleteStage(
      { targetPipelineId: req.params.pipelineId, targetStageId: req.params.stageId, moveCardsToStageId },
      loggedUserContext,
    );
    sendSuccessMessage(res, HttpStatus.OK, PIPELINE_SUCCESS_MESSAGES.STAGE_DELETED);
  };

  listStageCards = async (req: Request<PipelineStageParams>, res: Response) => {
    const query = readValidatedQuery<StageCardsQuery>(res);
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    const stageCardsPage = await this.pipelineService.listStageCards(
      { targetPipelineId: req.params.pipelineId, targetStageId: req.params.stageId, query },
      loggedUserContext,
    );
    res.status(HttpStatus.OK).json(stageCardsPage);
  };

  addCard = async (req: Request<PipelineIdParams>, res: Response) => {
    const card: AddCardInput = req.body;
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    await this.pipelineService.addCard({ targetPipelineId: req.params.pipelineId, card }, loggedUserContext);
    sendSuccessMessage(res, HttpStatus.CREATED, PIPELINE_SUCCESS_MESSAGES.CARD_ADDED);
  };

  moveCard = async (req: Request<PipelineCardParams>, res: Response) => {
    const move: MoveCardInput = req.body;
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    await this.pipelineService.moveCard({ targetPipelineId: req.params.pipelineId, targetCardId: req.params.cardId, move }, loggedUserContext);
    sendSuccessMessage(res, HttpStatus.OK, PIPELINE_SUCCESS_MESSAGES.CARD_MOVED);
  };

  removeCard = async (req: Request<PipelineCardParams>, res: Response) => {
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    await this.pipelineService.removeCard({ targetPipelineId: req.params.pipelineId, targetCardId: req.params.cardId }, loggedUserContext);
    sendSuccessMessage(res, HttpStatus.OK, PIPELINE_SUCCESS_MESSAGES.CARD_REMOVED);
  };
}
