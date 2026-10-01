import { Router } from 'express';
import type { LeadImportController } from '@/controllers/lead-import.controller';
import type { LeadIndicatorsController } from '@/controllers/lead-indicators.controller';
import type { LeadController } from '@/controllers/lead.controller';
import { BadRequestError } from '@/errors/app-errors';
import { LEAD_IMPORT_ERRORS } from '@/errors/errors.constants';
import type { AuthMiddleware } from '@/middlewares/auth.middleware';
import type { CsvUploadMiddleware } from '@/middlewares/csv-upload.middleware';
import type { RateLimitMiddleware } from '@/middlewares/rate-limit.middleware';
import { leadImportFileSchema, leadImportIdParamsSchema } from '@/middlewares/schemas/lead-import.schema';
import {
  createLeadSchema,
  leadIdParamsSchema,
  leadListFiltersSchema,
  updateLeadSchema,
} from '@/middlewares/schemas/lead.schema';
import type { ValidationMiddleware } from '@/middlewares/validation.middleware';

const missingCsvFile = () => new BadRequestError(LEAD_IMPORT_ERRORS.MISSING_FILE);

export class LeadRoutes {
  readonly router = Router();

  constructor(
    private readonly leads: LeadController,
    private readonly leadIndicators: LeadIndicatorsController,
    private readonly leadImports: LeadImportController,
    private readonly authMiddleware: AuthMiddleware,
    private readonly validate: ValidationMiddleware,
    private readonly csvUpload: CsvUploadMiddleware,
    private readonly rateLimit: RateLimitMiddleware,
  ) {
    this.registerIndicatorRoutes();
    this.registerImportRoutes();
    this.registerReadRoutes();
    this.registerWriteRoutes();
  }

  private registerIndicatorRoutes() {
    this.router.get('/indicators/total-leads', this.leadIndicators.getTotalLeads);
    this.router.get('/indicators/new-leads', this.leadIndicators.getNewLeadsInLastSevenDays);
    this.router.get('/indicators/unassigned-leads', this.leadIndicators.getUnassignedLeads);
    this.router.get('/indicators/invalid-or-rejected-contacts', this.leadIndicators.getInvalidOrRejectedContacts);
    this.router.get('/indicators/complete-profiles', this.leadIndicators.getCompleteProfiles);
  }

  private registerImportRoutes() {
    this.router.post(
      '/imports',
      this.rateLimit.leadImportLimiter,
      this.csvUpload.readCsvBody,
      this.validate.validateBody(leadImportFileSchema, missingCsvFile),
      this.leadImports.requestLeadImport,
    );
    this.router.get(
      '/imports/:importId',
      this.validate.validateParams(leadImportIdParamsSchema),
      this.leadImports.getLeadImportProgress,
    );
    this.router.post(
      '/imports/:importId/retry',
      this.rateLimit.leadImportLimiter,
      this.validate.validateParams(leadImportIdParamsSchema),
      this.leadImports.retryLeadImport,
    );
  }

  private registerReadRoutes() {
    this.router.get('/', this.validate.validateQuery(leadListFiltersSchema), this.leads.listLeads);
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
