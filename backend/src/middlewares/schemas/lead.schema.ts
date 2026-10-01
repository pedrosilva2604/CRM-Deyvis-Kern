import { LeadContactStatus } from '@prisma/client';
import { z, type ZodType, type ZodTypeDef } from 'zod';
import { findProblemWithLeadName, isValidEmail, normalizeEmail, normalizeLeadName, readLeadPhone } from '@crm/shared';
import type {
  CreateLeadInput,
  LeadIdParams,
  LeadListFilters,
  UpdateLeadInput,
} from '@/models/lead.model';
import { UNASSIGNED_LEADS_FILTER } from '@/models/lead.model';

const DEFAULT_PAGE_SIZE = 20;
const MAXIMUM_PAGE_SIZE = 100;
const MAXIMUM_PAGE = 100_000;
const MAXIMUM_SEARCH_LENGTH = 100;
const MAXIMUM_SOURCE_LENGTH = 60;
const MAXIMUM_TAG_LENGTH = 30;
const MAXIMUM_TAGS_PER_LEAD = 20;
const MAXIMUM_LEAD_VALUE = 9_999_999_999.99;
const ISO_DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

const leadNameSchema = z
  .string({ required_error: 'Informe o nome' })
  .transform(normalizeLeadName)
  .superRefine((normalizedName, context) => {
    const problem = findProblemWithLeadName(normalizedName);
    if (problem) context.addIssue({ code: z.ZodIssueCode.custom, message: problem });
  });

const leadPhoneSchema = z.string({ required_error: 'Informe o telefone' }).transform((rawPhone, context) => {
  const phoneReading = readLeadPhone(rawPhone);
  if (phoneReading.status === 'valid') return phoneReading.internationalPhone;
  context.addIssue({
    code: z.ZodIssueCode.custom,
    message: phoneReading.status === 'empty' ? 'Informe o telefone' : phoneReading.reason,
  });
  return z.NEVER;
});

const leadEmailSchema = z
  .string()
  .transform(normalizeEmail)
  .transform((normalizedEmail) => (normalizedEmail === '' ? null : normalizedEmail))
  .refine((normalizedEmail) => normalizedEmail === null || isValidEmail(normalizedEmail), 'E-mail inválido')
  .nullable();

const enteredOnSchema = z.string().regex(ISO_DATE_FORMAT, 'Data de entrada no formato aaaa-mm-dd');

const leadSourceSchema = z
  .string()
  .trim()
  .max(MAXIMUM_SOURCE_LENGTH)
  .transform((source) => (source === '' ? null : source))
  .nullable();

const leadTagsSchema = z
  .array(z.string().trim().min(1).max(MAXIMUM_TAG_LENGTH))
  .max(MAXIMUM_TAGS_PER_LEAD)
  .transform((tags) => [...new Set(tags)]);

const leadValueSchema = z
  .union([z.number(), z.string().trim().regex(/^\d+(\.\d{1,2})?$/, 'Valor no formato 1500.00')])
  .transform(Number)
  .refine((amount) => amount >= 0 && amount <= MAXIMUM_LEAD_VALUE, 'Valor fora do permitido')
  .transform((amount) => amount.toFixed(2))
  .nullable();

const stageIdSchema = z.string().uuid('Etapa inválida');
const assigneeIdSchema = z.string().uuid('Responsável inválido').nullable();

export const createLeadSchema: ZodType<CreateLeadInput, ZodTypeDef, unknown> = z
  .object({
    name: leadNameSchema,
    phone: leadPhoneSchema,
    email: leadEmailSchema.default(null),
    enteredOn: enteredOnSchema.nullable().default(null),
    stageId: stageIdSchema,
    source: leadSourceSchema.default(null),
    tags: leadTagsSchema.default([]),
    value: leadValueSchema.default(null),
    assignedToId: assigneeIdSchema.default(null),
  })
  .strict('Campo não permitido');

export const updateLeadSchema: ZodType<UpdateLeadInput, ZodTypeDef, unknown> = z
  .object({
    name: leadNameSchema.optional(),
    phone: leadPhoneSchema.optional(),
    email: leadEmailSchema.optional(),
    enteredOn: enteredOnSchema.optional(),
    stageId: stageIdSchema.optional(),
    source: leadSourceSchema.optional(),
    tags: leadTagsSchema.optional(),
    value: leadValueSchema.optional(),
    assignedToId: assigneeIdSchema.optional(),
    contactStatus: z.nativeEnum(LeadContactStatus).optional(),
  })
  .strict('Campo não permitido nesta atualização')
  .refine((leadChanges) => Object.values(leadChanges).some((value) => value !== undefined), {
    message: 'Informe ao menos um campo para atualizar',
  });

export const leadIdParamsSchema: ZodType<LeadIdParams, ZodTypeDef, unknown> = z.object({
  leadId: z.string().uuid('Identificador de lead inválido'),
});

export const leadListFiltersSchema: ZodType<LeadListFilters, ZodTypeDef, unknown> = z
  .object({
    search: z
      .string()
      .trim()
      .max(MAXIMUM_SEARCH_LENGTH)
      .optional()
      .transform((search) => search || undefined),
    stageId: z.string().uuid('Etapa inválida').optional(),
    source: z.string().trim().max(MAXIMUM_SOURCE_LENGTH).optional(),
    assignment: z.union([z.literal(UNASSIGNED_LEADS_FILTER), z.string().uuid('Responsável inválido')]).optional(),
    contactStatus: z.nativeEnum(LeadContactStatus).optional(),
    page: z.coerce.number().int().min(1).max(MAXIMUM_PAGE).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAXIMUM_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  })
  .strict('Filtro não permitido');
