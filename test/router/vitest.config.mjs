import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
export default defineConfig({
  root,
  cacheDir: `${root}test/tmp/router-cache`,
  resolve: { alias: {
    '@mnjs/router': `${root}packages/router/src/index.ts`,
    'marionette': `${root}src/index.ts`,
    '@mnjs/utils': `${root}packages/utils/src/index.ts`,
    '@mnjs/radio': `${root}packages/radio/src/index.ts`,
  } },
  test: {
    globals: false,
    environment: 'jsdom',
    include: ['test/unit/router/*.spec.mjs'],
    coverage: {
      provider: 'v8',
      reportsDirectory: `${root}coverage/router`,
      include: ['packages/router/src/**/*.ts'],
      reporter: ['text', 'json', 'json-summary'],
      thresholds: { perFile: true, lines: 100, statements: 100, functions: 100, branches: 100 },
    },
  },
});
