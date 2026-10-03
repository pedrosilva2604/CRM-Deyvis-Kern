import { PrismaClient, Role } from '@prisma/client';
import { z } from 'zod';
import { DEFAULT_PIPELINE_STAGES, defaultPipelineNameFor } from '../src/constants/default-pipeline';
import { Argon2PasswordHasher } from '../src/infra/password-hasher';

const seedEnvSchema = z.object({
  SEED_ADMIN_NAME: z.string().trim().min(2),
  SEED_ADMIN_EMAIL: z.string().trim().toLowerCase().email(),
  SEED_ADMIN_PASSWORD: z.string().min(12),
  ARGON2_MEMORY_KIB: z.coerce.number().int().min(19456),
  ARGON2_ITERATIONS: z.coerce.number().int().min(2),
  ARGON2_PARALLELISM: z.coerce.number().int().min(1).max(16),
});

const prisma = new PrismaClient();

function readSeedEnv() {
  const parsed = seedEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Variáveis do seed inválidas ou ausentes: ${Object.keys(parsed.error.flatten().fieldErrors).join(', ')}`);
  }
  return parsed.data;
}

async function seedAdmin(seedEnv: z.infer<typeof seedEnvSchema>) {
  const hasher = new Argon2PasswordHasher({
    memoryKib: seedEnv.ARGON2_MEMORY_KIB,
    iterations: seedEnv.ARGON2_ITERATIONS,
    parallelism: seedEnv.ARGON2_PARALLELISM,
  });
  const passwordHash = await hasher.hashPassword(seedEnv.SEED_ADMIN_PASSWORD);
  return await prisma.user.upsert({
    where: { email: seedEnv.SEED_ADMIN_EMAIL },
    update: {},
    create: { name: seedEnv.SEED_ADMIN_NAME, email: seedEnv.SEED_ADMIN_EMAIL, role: Role.ADMIN, passwordHash },
  });
}

async function seedPipelineOf(owner: { id: string; name: string }) {
  if ((await prisma.pipeline.count({ where: { ownerId: owner.id } })) > 0) return;
  await prisma.pipeline.create({
    data: { name: defaultPipelineNameFor(owner.name), ownerId: owner.id, stages: { create: DEFAULT_PIPELINE_STAGES } },
  });
}

async function main() {
  const seedEnv = readSeedEnv();
  const admin = await seedAdmin(seedEnv);
  await seedPipelineOf(admin);
  console.log('Seed concluído.');
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
