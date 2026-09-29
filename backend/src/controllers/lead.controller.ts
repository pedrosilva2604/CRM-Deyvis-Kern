import type { Request, Response } from 'express';
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
    res.status(200).json(leadListPage);
  };

  getLeadBaseIndicators = async (_req: Request, res: Response) => {
    const leadBaseIndicators = await this.leadService.getLeadBaseIndicators();
    res.status(200).json(leadBaseIndicators);
  };

  getLeadFilterOptions = async (_req: Request, res: Response) => {
    const leadFilterOptions = await this.leadService.getLeadFilterOptions();
    res.status(200).json(leadFilterOptions);
  };

  getLeadDetails = async (req: Request<LeadIdParams>, res: Response) => {
    const leadDetails = await this.leadService.getLeadDetails({ targetLeadId: req.params.leadId });
    res.status(200).json(leadDetails);
  };

  createLead = async (req: Request, res: Response) => {
    const newLead: CreateLeadInput = req.body;
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    const createdLead = await this.leadService.createLead(newLead, loggedUserContext);
    res.status(201).json(createdLead);
  };

  updateLead = async (req: Request<LeadIdParams>, res: Response) => {
    const leadChanges: UpdateLeadInput = req.body;
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    const updatedLead = await this.leadService.updateLead({ targetLeadId: req.params.leadId, leadChanges }, loggedUserContext);
    res.status(200).json(updatedLead);
  };

  deleteLead = async (req: Request<LeadIdParams>, res: Response) => {
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    await this.leadService.deleteLead({ targetLeadId: req.params.leadId }, loggedUserContext);
    res.status(204).send();
  };
}
