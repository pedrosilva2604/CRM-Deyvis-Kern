import { Role, Theme } from '@prisma/client';
import { z, type ZodType, type ZodTypeDef } from 'zod';
import type {
  RegisterUserInput,
  UpdateThemeInput,
  UpdateUserInput,
  UpdateUserPasswordInput,
  UpdateUserStatusInput,
  UserIdParams,
} from '@/models/user.model';
import { emailSchema, newPasswordSchema } from './common.schema';

const userNameSchema = z.string().trim().min(2, 'Informe o nome').max(120);

export const registerUserSchema: ZodType<RegisterUserInput, ZodTypeDef, unknown> = z.object({
  name: userNameSchema,
  email: emailSchema,
  password: newPasswordSchema,
  role: z.nativeEnum(Role).default(Role.AGENT),
});

export const updateUserSchema: ZodType<UpdateUserInput, ZodTypeDef, unknown> = z
  .object({
    name: userNameSchema.optional(),
    email: emailSchema.optional(),
    role: z.nativeEnum(Role).optional(),
  })
  .strict('Campo não permitido nesta atualização')
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Informe ao menos um campo para atualizar',
  });

export const updateUserStatusSchema: ZodType<UpdateUserStatusInput, ZodTypeDef, unknown> = z
  .object({
    active: z.boolean({ required_error: 'Informe o status', invalid_type_error: 'Status inválido' }),
  })
  .strict('Campo não permitido nesta atualização');

export const updateUserPasswordSchema: ZodType<UpdateUserPasswordInput, ZodTypeDef, unknown> = z
  .object({
    password: newPasswordSchema,
  })
  .strict('Campo não permitido nesta atualização');

export const userIdParamsSchema: ZodType<UserIdParams, ZodTypeDef, unknown> = z.object({
  id: z.string().uuid('Identificador inválido'),
});

export const updateThemeSchema: ZodType<UpdateThemeInput, ZodTypeDef, unknown> = z.object({
  theme: z.nativeEnum(Theme),
});
