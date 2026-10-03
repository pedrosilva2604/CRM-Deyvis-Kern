import { z, type ZodType, type ZodTypeDef } from 'zod';
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
import { MAXIMUM_STAGES_PER_PIPELINE } from '@/constants/pipeline-limits';
import { moneyValueSchema } from './lead.schema';

const MAXIMUM_PIPELINE_NAME_LENGTH = 60;
const MAXIMUM_STAGE_NAME_LENGTH = 40;
const MAXIMUM_CLOSING_NOTE_LENGTH = 500;
const DEFAULT_CARDS_PER_PAGE = 50;
const MAXIMUM_CARDS_PER_PAGE = 100;
const STAGE_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

const pipelineIdSchema = z.string().uuid('Funil inválido');
const stageIdSchema = z.string().uuid('Etapa inválida');
const pipelineNameSchema = z.string().trim().min(1, 'Informe o nome do funil').max(MAXIMUM_PIPELINE_NAME_LENGTH);
const stageNameSchema = z.string().trim().min(1, 'Informe o nome da etapa').max(MAXIMUM_STAGE_NAME_LENGTH);
const stageColorSchema = z.string().regex(STAGE_COLOR_PATTERN, 'Cor no formato #RRGGBB');
const notBothWonAndLost = (stage: { isWon?: boolean; isLost?: boolean }) => !(stage.isWon && stage.isLost);
const WON_AND_LOST_MESSAGE = { message: 'Uma etapa não pode ser de ganho e de perda ao mesmo tempo' };

export const pipelineIdParamsSchema: ZodType<PipelineIdParams, ZodTypeDef, unknown> = z.object({
  pipelineId: pipelineIdSchema,
});

export const pipelineStageParamsSchema: ZodType<PipelineStageParams, ZodTypeDef, unknown> = z.object({
  pipelineId: pipelineIdSchema,
  stageId: stageIdSchema,
});

export const pipelineMemberParamsSchema: ZodType<PipelineMemberParams, ZodTypeDef, unknown> = z.object({
  pipelineId: pipelineIdSchema,
  userId: z.string().uuid('Usuário inválido'),
});

export const pipelineCardParamsSchema: ZodType<PipelineCardParams, ZodTypeDef, unknown> = z.object({
  pipelineId: pipelineIdSchema,
  cardId: z.string().uuid('Cartão inválido'),
});

export const createPipelineSchema: ZodType<CreatePipelineInput, ZodTypeDef, unknown> = z
  .object({
    name: pipelineNameSchema,
    ownerId: z.string().uuid('Dono inválido').nullable().default(null),
  })
  .strict('Campo não permitido');

export const renamePipelineSchema: ZodType<RenamePipelineInput, ZodTypeDef, unknown> = z
  .object({ name: pipelineNameSchema })
  .strict('Campo não permitido');

export const addPipelineMemberSchema: ZodType<AddPipelineMemberInput, ZodTypeDef, unknown> = z
  .object({ userId: z.string().uuid('Usuário inválido') })
  .strict('Campo não permitido');

export const createStageSchema: ZodType<StageInput, ZodTypeDef, unknown> = z
  .object({
    name: stageNameSchema,
    color: stageColorSchema,
    isWon: z.boolean().default(false),
    isLost: z.boolean().default(false),
  })
  .strict('Campo não permitido')
  .refine(notBothWonAndLost, WON_AND_LOST_MESSAGE);

export const updateStageSchema: ZodType<UpdateStageInput, ZodTypeDef, unknown> = z
  .object({
    name: stageNameSchema.optional(),
    color: stageColorSchema.optional(),
    isWon: z.boolean().optional(),
    isLost: z.boolean().optional(),
  })
  .strict('Campo não permitido')
  .refine((stageChanges) => Object.values(stageChanges).some((value) => value !== undefined), {
    message: 'Informe ao menos um campo para atualizar',
  })
  .refine(notBothWonAndLost, WON_AND_LOST_MESSAGE);

export const reorderStagesSchema: ZodType<ReorderStagesInput, ZodTypeDef, unknown> = z
  .object({ stageIds: z.array(stageIdSchema).min(1).max(MAXIMUM_STAGES_PER_PIPELINE) })
  .strict('Campo não permitido');

export const deleteStageQuerySchema: ZodType<DeleteStageQuery, ZodTypeDef, unknown> = z
  .object({ moveCardsToStageId: stageIdSchema })
  .strict('Filtro não permitido');

export const stageCardsQuerySchema: ZodType<StageCardsQuery, ZodTypeDef, unknown> = z
  .object({
    afterPosition: z.coerce.number().finite().optional().transform((afterPosition) => afterPosition ?? null),
    limit: z.coerce.number().int().min(1).max(MAXIMUM_CARDS_PER_PAGE).default(DEFAULT_CARDS_PER_PAGE),
  })
  .strict('Filtro não permitido');

export const addCardSchema: ZodType<AddCardInput, ZodTypeDef, unknown> = z
  .object({ leadId: z.string().uuid('Lead inválido'), stageId: stageIdSchema })
  .strict('Campo não permitido');

export const moveCardSchema: ZodType<MoveCardInput, ZodTypeDef, unknown> = z
  .object({
    stageId: stageIdSchema,
    previousCardId: z.string().uuid('Cartão de referência inválido').nullable().default(null),
    wonValue: moneyValueSchema.default(null),
    closingNote: z
      .string()
      .trim()
      .max(MAXIMUM_CLOSING_NOTE_LENGTH)
      .nullable()
      .default(null)
      .transform((closingNote) => closingNote || null),
  })
  .strict('Campo não permitido');
