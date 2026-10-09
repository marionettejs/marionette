import { resolvePolicy } from './scripts/testing/mutation.mjs';

const release = process.env.MARIONETTE_MUTATION_PROFILE === 'release';
const policy = await resolvePolicy(undefined, process.env.MARIONETTE_MUTATION_PROFILE || 'runtime');
if (release && policy.testFiles.some(file => !/^test\/[\w./*-]+$/.test(file))) {
  throw new Error('Release mutation test paths must be shell-safe paths under test/.');
}
const runId = process.env.MARIONETTE_MUTATION_RUN_ID;
if (!runId || !/^[\w-]+$/.test(runId)) {
  throw new Error('Run mutation testing through node scripts/testing/mutation.mjs for bounded execution and retained evidence.');
}

export default {
  $schema: './node_modules/@stryker-mutator/core/schema/stryker-schema.json',
  mutate: policy.mutate,
  ...(release ? { commandRunner: { command: `node --test ${policy.testFiles.join(' ')}` } } : {
    testFiles: policy.testFiles,
    vitest: { configFile: 'vitest.config.js' },
  }),
  concurrency: policy.concurrency,
  testRunner: release ? 'command' : 'vitest',
  coverageAnalysis: release ? 'off' : 'perTest',
  reporters: ['clear-text', 'json', 'html'],
  jsonReporter: { fileName: `coverage/mutation/${runId}/mutation.json` },
  htmlReporter: { fileName: `coverage/mutation/${runId}/index.html` },
  tempDirName: `test/tmp/mutation/${runId}`,
  cleanTempDir: true,
  ignorePatterns: ['coverage', 'test/tmp', 'dist', 'packages/*/dist', '.docs-site'],
  timeoutMS: 10000,
  dryRunTimeoutMinutes: 2,
  thresholds: { high: 90, low: 70, break: null }
};
