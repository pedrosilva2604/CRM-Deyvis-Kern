import { z, type ZodType, type ZodTypeDef } from 'zod';
import type { ForgotPasswordInput, LoginInput, ResetPasswordInput } from '@/models/auth.model';
import { currentPasswordSchema, emailSchema, newPasswordSchema } from './common.schema';

export const loginSchema: ZodType<LoginInput, ZodTypeDef, unknown> = z.object({
  email: emailSchema,
  password: currentPasswordSchema,
});

export const forgotPasswordSchema: ZodType<ForgotPasswordInput, ZodTypeDef, unknown> = z.object({
  email: emailSchema,
});

export const resetPasswordSchema: ZodType<ResetPasswordInput, ZodTypeDef, unknown> = z.object({
  token: z.string().min(20).max(256),
  password: newPasswordSchema,
});
