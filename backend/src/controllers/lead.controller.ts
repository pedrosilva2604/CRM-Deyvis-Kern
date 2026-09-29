import type { Request, Response } from 'express';
import { LEAD_SUCCESS_MESSAGES } from '@/constants/success-messages';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '@/errors/app-errors';
import { HttpStatus, sendErrorResponse, sendSuccessMessage } from '@/lib/http-status';
import type { RequestContextExtractor } from '@/lib/request-context-extractor';
import { readValidatedQuery } from '@/middlewares/validation.middleware';
import type { CreateLeadInput, LeadIdParams, LeadListFilters, UpdateLeadInput } from '@/models/lead.model';
import type { ILeadService } from '@/services/lead.service';

export class LeadController {
  constructor(
    private readonly leadService: ILeadService,
    private readonly requestContextExtractor: RequestContextExtractor,
  ) {}

  listLeads = async (_req: Request, res: Response) => {
    const filters = readValidatedQuery<LeadListFilters>(res);
    const leadListPage = await this.leadService.listLeads(filters);
    res.status(HttpStatus.OK).json(leadListPage);
  };

  getLeadBaseIndicators = async (_req: Request, res: Response) => {
    const leadBaseIndicators = await this.leadService.getLeadBaseIndicators();
    res.status(HttpStatus.OK).json(leadBaseIndicators);
  };

  getLeadFilterOptions = async (_req: Request, res: Response) => {
    const leadFilterOptions = await this.leadService.getLeadFilterOptions();
    res.status(HttpStatus.OK).json(leadFilterOptions);
  };

  getLeadDetails = async (req: Request<LeadIdParams>, res: Response) => {
    try {
      const leadDetails = await this.leadService.getLeadDetails({ targetLeadId: req.params.leadId });
      res.status(HttpStatus.OK).json(leadDetails);
    } catch (error) {
      if (error instanceof NotFoundError) return sendErrorResponse(res, HttpStatus.NOT_FOUND, error);
      throw error;
    }
  };

  createLead = async (req: Request, res: Response) => {
    try {
      const newLead: CreateLeadInput = req.body;
      const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
      await this.leadService.createLead(newLead, loggedUserContext);
      sendSuccessMessage(res, HttpStatus.CREATED, LEAD_SUCCESS_MESSAGES.CREATED);
    } catch (error) {
      if (error instanceof BadRequestError) return sendErrorResponse(res, HttpStatus.BAD_REQUEST, error);
      if (error instanceof ConflictError) return sendErrorResponse(res, HttpStatus.CONFLICT, error);
      throw error;
    }
  };

  updateLead = async (req: Request<LeadIdParams>, res: Response) => {
    try {
      const leadChanges: UpdateLeadInput = req.body;
      const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
      await this.leadService.updateLead({ targetLeadId: req.params.leadId, leadChanges }, loggedUserContext);
      sendSuccessMessage(res, HttpStatus.OK, LEAD_SUCCESS_MESSAGES.UPDATED);
    } catch (error) {
      if (error instanceof NotFoundError) return sendErrorResponse(res, HttpStatus.NOT_FOUND, error);
      if (error instanceof BadRequestError) return sendErrorResponse(res, HttpStatus.BAD_REQUEST, error);
      if (error instanceof ConflictError) return sendErrorResponse(res, HttpStatus.CONFLICT, error);
      throw error;
    }
  };

  deleteLead = async (req: Request<LeadIdParams>, res: Response) => {
    try {
      const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
      await this.leadService.deleteLead({ targetLeadId: req.params.leadId }, loggedUserContext);
      sendSuccessMessage(res, HttpStatus.OK, LEAD_SUCCESS_MESSAGES.DELETED);
    } catch (error) {
      if (error instanceof ForbiddenError) return sendErrorResponse(res, HttpStatus.FORBIDDEN, error);
      if (error instanceof NotFoundError) return sendErrorResponse(res, HttpStatus.NOT_FOUND, error);
      throw error;
    }
  };
}
