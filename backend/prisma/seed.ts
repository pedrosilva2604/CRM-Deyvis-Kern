import bcrypt from 'bcryptjs';
import { PrismaClient, Role } from '@prisma/client';
import { z } from 'zod';

const seedEnvSchema = z.object({
  SEED_ADMIN_NAME: z.string().trim().min(2),
  SEED_ADMIN_EMAIL: z.string().trim().toLowerCase().email(),
  SEED_ADMIN_PASSWORD: z.string().min(12),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15),
});

const defaultPipeline = {
  name: 'Funil de Vendas',
  stages: [
    { name: 'Novo lead', color: '#3b82f6', position: 0 },
    { name: 'Em atendimento', color: '#f59e0b', position: 1 },
    { name: 'Proposta', color: '#8b5cf6', position: 2 },
    { name: 'Ganho', color: '#22c55e', position: 3, isWon: true },
    { name: 'Perdido', color: '#ef4444', position: 4, isLost: true },
  ],
};

const prisma = new PrismaClient();

function readSeedEnv() {
  const parsed = seedEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Variáveis do seed inválidas ou ausentes: ${Object.keys(parsed.error.flatten().fieldErrors).join(', ')}`);
  }
  return parsed.data;
}

async function seedAdmin(seedEnv: z.infer<typeof seedEnvSchema>) {
  const passwordHash = await bcrypt.hash(seedEnv.SEED_ADMIN_PASSWORD, seedEnv.BCRYPT_ROUNDS);
  await prisma.user.upsert({
    where: { email: seedEnv.SEED_ADMIN_EMAIL },
    update: {},
    create: { name: seedEnv.SEED_ADMIN_NAME, email: seedEnv.SEED_ADMIN_EMAIL, role: Role.ADMIN, passwordHash },
  });
}

async function seedDefaultPipeline() {
  if ((await prisma.pipeline.count()) > 0) return;
  await prisma.pipeline.create({
    data: { name: defaultPipeline.name, stages: { create: defaultPipeline.stages } },
  });
}

async function main() {
  const seedEnv = readSeedEnv();
  await seedAdmin(seedEnv);
  await seedDefaultPipeline();
  console.log('Seed concluído.');
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
