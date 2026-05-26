import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup/vitest.js'],
    include: ['test/unit/**/*.spec.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'backbone.js',
        'config/**/*.js',
        'index.js',
        'jquery-dom-api.js',
        'mixins/**/*.js',
        'modules/**/*.js',
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
