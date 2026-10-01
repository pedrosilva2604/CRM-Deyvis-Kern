import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

const INTEGRATION_TESTS = 'src/**/*.integration.test.ts';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          exclude: [...configDefaults.exclude, INTEGRATION_TESTS],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: [INTEGRATION_TESTS],
          environment: 'node',
          globalSetup: ['src/testing/integration/prepare-test-database.ts'],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
