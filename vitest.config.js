import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: [{
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
        'packages/adapters/src/**/*.js',
        'packages/data/src/**/*.js'
      ],
      thresholds: {
        lines: 100,
        branches: 100
      }
    }
  }
});
