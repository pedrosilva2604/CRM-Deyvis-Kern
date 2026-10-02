import type { Request, Response } from 'express';
import { LEAD_IMPORT_SUCCESS_MESSAGES } from '@/constants/success-messages';
import { HttpStatus } from '@/infra/http-status';
import type { RequestContextExtractor } from '@/infra/request-context-extractor';
import type { LeadImportIdParams } from '@/models/lead-import.model';
import type { PipelineStageParams } from '@/models/pipeline.model';
import type { ILeadImportService } from '@/services/lead-import.service';

export class LeadImportController {
  constructor(
    private readonly leadImportService: ILeadImportService,
    private readonly requestContextExtractor: RequestContextExtractor,
  ) {}

  requestLeadImport = async (req: Request, res: Response) => {
    const csvText: string = req.body;
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    const { importId } = await this.leadImportService.requestLeadImport(csvText, loggedUserContext);
    res.status(HttpStatus.ACCEPTED).json({ message: LEAD_IMPORT_SUCCESS_MESSAGES.REQUESTED, importId });
  };

  requestLeadImportIntoPipeline = async (req: Request<PipelineStageParams>, res: Response) => {
    const csvText: string = req.body;
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    const { importId } = await this.leadImportService.requestLeadImportIntoPipeline(
      { targetPipelineId: req.params.pipelineId, targetStageId: req.params.stageId, csvText },
      loggedUserContext,
    );
    res.status(HttpStatus.ACCEPTED).json({ message: LEAD_IMPORT_SUCCESS_MESSAGES.REQUESTED, importId });
  };

  getLeadImportProgress = async (req: Request<LeadImportIdParams>, res: Response) => {
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    const leadImportProgress = await this.leadImportService.getLeadImportProgress(
      { targetImportId: req.params.importId },
      loggedUserContext,
    );
    res.status(HttpStatus.OK).json(leadImportProgress);
  };

  retryLeadImport = async (req: Request<LeadImportIdParams>, res: Response) => {
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    await this.leadImportService.retryLeadImport({ targetImportId: req.params.importId }, loggedUserContext);
    res.status(HttpStatus.ACCEPTED).json({ message: LEAD_IMPORT_SUCCESS_MESSAGES.RETRY_REQUESTED });
  };
}
