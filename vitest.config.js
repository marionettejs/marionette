import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: [{
      find: /^marionette$/,
      replacement: fileURLToPath(new URL('./index.js', import.meta.url))
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
        'index.js',
        'mixins/**/*.js',
        'packages/adapters/src/**/*.js',
        'modules/**/*.js',
        'packages/data/src/**/*.js',
        'runtime/**/*.js',
        'utils/**/*.js',
        'version.js'
      ],
      thresholds: {
        lines: 100,
        branches: 100
      }
    }
  }
});
