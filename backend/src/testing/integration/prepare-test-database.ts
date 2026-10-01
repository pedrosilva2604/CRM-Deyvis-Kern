import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    testDatabaseUrl: string;
  }
}

const BACKEND_FOLDER = path.resolve(import.meta.dirname, '../../..');
const LOCAL_ENV_FILE = path.join(BACKEND_FOLDER, '.env');
const TEST_DATABASE_NAME_SUFFIX = '_test';

function readTestDatabaseUrl(): string {
  if (!process.env.TEST_DATABASE_URL && existsSync(LOCAL_ENV_FILE)) process.loadEnvFile(LOCAL_ENV_FILE);
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  if (!testDatabaseUrl) throw new Error('Defina TEST_DATABASE_URL para rodar os testes de integração');
  return testDatabaseUrl;
}

function refuseDatabaseThatIsNotForTests(testDatabaseUrl: string): void {
  const databaseName = new URL(testDatabaseUrl).pathname.slice(1);
  if (!databaseName.endsWith(TEST_DATABASE_NAME_SUFFIX)) {
    throw new Error(`Os testes de integração apagam dados: o banco precisa terminar em "${TEST_DATABASE_NAME_SUFFIX}"`);
  }
}

function applyMigrations(testDatabaseUrl: string): void {
  const prismaCommandLine = path.join(path.dirname(createRequire(import.meta.url).resolve('prisma/package.json')), 'build/index.js');
  execFileSync(process.execPath, [prismaCommandLine, 'migrate', 'deploy'], {
    cwd: BACKEND_FOLDER,
    env: { ...process.env, DATABASE_URL: testDatabaseUrl, PRISMA_HIDE_UPDATE_MESSAGE: 'true' },
    stdio: 'pipe',
  });
}

export default function prepareTestDatabase(project: TestProject): void {
  const testDatabaseUrl = readTestDatabaseUrl();
  refuseDatabaseThatIsNotForTests(testDatabaseUrl);
  applyMigrations(testDatabaseUrl);
  project.provide('testDatabaseUrl', testDatabaseUrl);
}
