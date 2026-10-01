import { z, type ZodType, type ZodTypeDef } from 'zod';
import { LEAD_IMPORT_ERRORS } from '@/errors/errors.constants';
import type { LeadImportIdParams } from '@/models/lead-import.model';

export const leadImportFileSchema: ZodType<string, ZodTypeDef, unknown> = z
  .string({ required_error: LEAD_IMPORT_ERRORS.MISSING_FILE, invalid_type_error: LEAD_IMPORT_ERRORS.MISSING_FILE })
  .refine((csvText) => csvText.trim() !== '', LEAD_IMPORT_ERRORS.MISSING_FILE);

export const leadImportIdParamsSchema: ZodType<LeadImportIdParams, ZodTypeDef, unknown> = z.object({
  importId: z.string().uuid('Identificador de importação inválido'),
});
