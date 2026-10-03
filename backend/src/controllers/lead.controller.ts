import type { Request, Response } from 'express';
import { LEAD_SUCCESS_MESSAGES } from '@/constants/success-messages';
import { HttpStatus, sendSuccessMessage } from '@/infra/http-status';
import type { RequestContextExtractor } from '@/infra/request-context-extractor';
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

  getLeadFilterOptions = async (_req: Request, res: Response) => {
    const leadFilterOptions = await this.leadService.getLeadFilterOptions();
    res.status(HttpStatus.OK).json(leadFilterOptions);
  };

  getLeadDetails = async (req: Request<LeadIdParams>, res: Response) => {
    const leadDetails = await this.leadService.getLeadDetails({ targetLeadId: req.params.leadId });
    res.status(HttpStatus.OK).json(leadDetails);
  };

  createLead = async (req: Request, res: Response) => {
    const newLead: CreateLeadInput = req.body;
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    await this.leadService.createLead(newLead, loggedUserContext);
    sendSuccessMessage(res, HttpStatus.CREATED, LEAD_SUCCESS_MESSAGES.CREATED);
  };

  updateLead = async (req: Request<LeadIdParams>, res: Response) => {
    const leadChanges: UpdateLeadInput = req.body;
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    await this.leadService.updateLead({ targetLeadId: req.params.leadId, leadChanges }, loggedUserContext);
    sendSuccessMessage(res, HttpStatus.OK, LEAD_SUCCESS_MESSAGES.UPDATED);
  };

  deleteLead = async (req: Request<LeadIdParams>, res: Response) => {
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    await this.leadService.deleteLead({ targetLeadId: req.params.leadId }, loggedUserContext);
    sendSuccessMessage(res, HttpStatus.OK, LEAD_SUCCESS_MESSAGES.DELETED);
  };
}
