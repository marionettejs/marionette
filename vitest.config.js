import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: [{
      find: /^@marionette\/utils$/,
      replacement: fileURLToPath(new URL('./packages/utils/src/index.ts', import.meta.url))
    }, {
      find: /^marionette$/,
      replacement: fileURLToPath(new URL('./src/index.ts', import.meta.url))
    }]
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup/vitest.js'],
    include: ['test/unit/**/*.spec.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'src/**/*.{js,ts}',
        'packages/adapters/src/**/*.ts',
        'packages/data/src/**/*.ts',
        'packages/utils/src/**/*.ts'
      ],
      thresholds: {
        lines: 100,
        branches: 100
      }
    }
  }
});
