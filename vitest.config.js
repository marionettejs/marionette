import { globSync, readFileSync } from 'node:fs';
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


const coverageFiles = [
  'src/**/*.{js,ts}', 'packages/adapters/src/**/*.ts', 'packages/data/src/**/*.ts',
  'packages/utils/src/**/*.ts', 'packages/radio/src/**/*.ts'
];
const coverageExceptions = JSON.parse(readFileSync(new URL('./config/coverage-exceptions.json', import.meta.url), 'utf8'));
const thresholds = { lines: 100, statements: 100, functions: 100, branches: 100 };
for (const metric of ['lines', 'statements', 'functions', 'branches']) {
  const maximum = Object.values(coverageExceptions).reduce((total, entry) => total + (entry[metric] || 0), 0);
  thresholds[metric] = maximum ? -maximum : 100;
}
const sourceFiles = globSync(coverageFiles, { cwd: import.meta.dirname }).map(file => file.replaceAll('\\', '/'));
for (const file of Object.keys(coverageExceptions)) {
  if (!sourceFiles.includes(file)) { throw new Error(`Stale coverage exception: ${file}`); }
}
for (const file of sourceFiles) {
  thresholds[file] = Object.fromEntries(['lines', 'statements', 'functions', 'branches'].map(metric => {
    const maximum = coverageExceptions[file]?.[metric] || 0;
    return [metric, maximum ? -maximum : 100];
  }));
}

export default defineConfig({
  resolve: {
    alias: [{
      find: /^@marionette\/data$/,
      replacement: fileURLToPath(new URL('./packages/data/src/index.ts', import.meta.url))
    }, {
      find: /^@marionette\/adapters\/xstate$/,
      replacement: fileURLToPath(new URL('./packages/adapters/src/data/xstate.ts', import.meta.url))
    }, {
      find: /^@marionette\/adapters\/backbone$/,
      replacement: fileURLToPath(new URL('./packages/adapters/src/data/backbone.ts', import.meta.url))
    }, {
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
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: { junit: './test/tmp/unit-results.xml' },
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
      reportsDirectory: 'coverage/library',
      reporter: ['text-summary', 'html', 'lcov', 'json-summary'],
      include: coverageFiles,
      thresholds
    }
  }
});
