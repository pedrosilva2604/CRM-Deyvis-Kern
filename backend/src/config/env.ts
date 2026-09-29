import { z } from 'zod';

const booleanFlag = z.enum(['true', 'false']).transform((value) => value === 'true');
const positiveInteger = z.coerce.number().int().positive();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: positiveInteger,
  APP_NAME: z.string().min(1),
  APP_URL: z.string().url(),
  CORS_ORIGIN: z.string().url(),
  JSON_BODY_LIMIT: z.string().min(1),
  TRUST_PROXY: z
    .string()
    .min(1)
    .transform((value) => (/^\d+$/.test(value) ? Number(value) : value)),
  DATABASE_URL: z.string().url(),

  JWT_SECRET: z.string().min(32),
  SESSION_TTL_HOURS: positiveInteger,
  SESSION_COOKIE_NAME: z.string().min(1),
  SESSION_COOKIE_SECURE: booleanFlag,
  ARGON2_MEMORY_KIB: z.coerce.number().int().min(19456),
  ARGON2_ITERATIONS: z.coerce.number().int().min(2),
  ARGON2_PARALLELISM: z.coerce.number().int().min(1).max(16),
  PASSWORD_RESET_TTL_MINUTES: positiveInteger,

  RATE_LIMIT_WINDOW_MINUTES: positiveInteger,
  API_RATE_LIMIT: positiveInteger,
  LOGIN_RATE_LIMIT: positiveInteger,
  FORGOT_PASSWORD_RATE_LIMIT: positiveInteger,
  RESET_PASSWORD_RATE_LIMIT: positiveInteger,

  EVOLUTION_API_URL: z.string().url(),
  EVOLUTION_API_KEY: z.string().min(16),
  WHATSAPP_CLOUD_API_URL: z.string().url(),
  WHATSAPP_CLOUD_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_CLOUD_BUSINESS_ACCOUNT_ID: z.string().optional(),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: positiveInteger,
  SMTP_SECURE: booleanFlag,
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variáveis de ambiente inválidas ou ausentes:', Object.keys(parsed.error.flatten().fieldErrors));
  process.exit(1);
}

export const env = parsed.data;
