import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const nodeTests = [
  'test/unit/events-*.spec.js',
  'test/unit/radio*.spec.js',
  'test/unit/requests.spec.js',
  'test/unit/modules-error.spec.js',
  'test/unit/config/*.spec.js',
  'test/unit/data-package/{model,collection,collection-observers}.spec.js',
  'test/unit/runtime/{data-api,state-api}.spec.js',
  'test/unit/utils/{build-event-args,call-handler,extend,get-value,is-string,once-wrap,set-property,subscribe-bindings}.spec.js'
];

export default defineConfig({
  resolve: {
    alias: [{
      find: /^@marionette\/adapters\/dom\/(morphdom|lit-html|jquery)$/,
      replacement: fileURLToPath(new URL('./packages/adapters/src/dom/$1.ts', import.meta.url))
    }, {
      find: /^@marionette\/radio$/,
      replacement: fileURLToPath(new URL('./packages/radio/src/index.ts', import.meta.url))
    }, {
      find: /^@marionette\/utils$/,
      replacement: fileURLToPath(new URL('./packages/utils/src/index.ts', import.meta.url))
    }, {
      find: /^marionette$/,
      replacement: fileURLToPath(new URL('./src/index.ts', import.meta.url))
    }]
  },
  test: {
    globals: false,
    setupFiles: ['./test/setup/vitest.js'],
    projects: [{
      extends: true,
      test: { name: 'node', environment: 'node', include: nodeTests }
    }, {
      extends: true,
      test: {
        name: 'dom',
        environment: 'jsdom',
        include: ['test/unit/**/*.spec.js'],
        exclude: nodeTests
      }
    }],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'src/**/*.{js,ts}',
        'packages/adapters/src/**/*.ts',
        'packages/data/src/**/*.ts',
        'packages/utils/src/**/*.ts',
        'packages/radio/src/**/*.ts'
      ],
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100
      }
    }
  }
});
