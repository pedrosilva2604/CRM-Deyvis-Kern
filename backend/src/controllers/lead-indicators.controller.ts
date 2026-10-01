import type { Request, Response } from 'express';
import { HttpStatus } from '@/infra/http-status';
import type { ILeadIndicatorsService } from '@/services/lead-indicators.service';

export class LeadIndicatorsController {
  constructor(private readonly leadIndicatorsService: ILeadIndicatorsService) {}

  getTotalLeads = async (_req: Request, res: Response) => {
    const totalLeadsIndicator = await this.leadIndicatorsService.getTotalLeads();
    res.status(HttpStatus.OK).json(totalLeadsIndicator);
  };

  getNewLeadsInLastSevenDays = async (_req: Request, res: Response) => {
    const newLeadsIndicator = await this.leadIndicatorsService.getNewLeadsInLastSevenDays();
    res.status(HttpStatus.OK).json(newLeadsIndicator);
  };

  getUnassignedLeads = async (_req: Request, res: Response) => {
    const unassignedLeadsIndicator = await this.leadIndicatorsService.getUnassignedLeads();
    res.status(HttpStatus.OK).json(unassignedLeadsIndicator);
  };

  getInvalidOrRejectedContacts = async (_req: Request, res: Response) => {
    const invalidOrRejectedContactsIndicator = await this.leadIndicatorsService.getInvalidOrRejectedContacts();
    res.status(HttpStatus.OK).json(invalidOrRejectedContactsIndicator);
  };

  getCompleteProfiles = async (_req: Request, res: Response) => {
    const completeProfilesIndicator = await this.leadIndicatorsService.getCompleteProfiles();
    res.status(HttpStatus.OK).json(completeProfilesIndicator);
  };
}
