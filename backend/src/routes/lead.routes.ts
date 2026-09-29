import { Router } from 'express';
import type { LeadController } from '@/controllers/lead.controller';
import type { AuthMiddleware } from '@/middlewares/auth.middleware';
import {
  createLeadSchema,
  leadIdParamsSchema,
  leadListFiltersSchema,
  updateLeadSchema,
} from '@/middlewares/schemas/lead.schema';
import type { ValidationMiddleware } from '@/middlewares/validation.middleware';

export class LeadRoutes {
  readonly router = Router();

  constructor(
    private readonly leads: LeadController,
    private readonly authMiddleware: AuthMiddleware,
    private readonly validate: ValidationMiddleware,
  ) {
    this.registerReadRoutes();
    this.registerWriteRoutes();
  }

  private registerReadRoutes() {
    this.router.get('/', this.validate.validateQuery(leadListFiltersSchema), this.leads.listLeads);
    this.router.get('/indicators', this.leads.getLeadBaseIndicators);
    this.router.get('/filter-options', this.leads.getLeadFilterOptions);
    this.router.get('/:leadId', this.validate.validateParams(leadIdParamsSchema), this.leads.getLeadDetails);
  }

  private registerWriteRoutes() {
    this.router.post('/', this.validate.validateBody(createLeadSchema), this.leads.createLead);
    this.router.patch(
      '/:leadId',
      this.validate.validateParams(leadIdParamsSchema),
      this.validate.validateBody(updateLeadSchema),
      this.leads.updateLead,
    );
    this.router.delete(
      '/:leadId',
      this.authMiddleware.requireRole('ADMIN'),
      this.validate.validateParams(leadIdParamsSchema),
      this.leads.deleteLead,
    );
  }
}
