import { resolvePolicy } from './scripts/testing/mutation.mjs';

const policy = await resolvePolicy();
const runId = process.env.MARIONETTE_MUTATION_RUN_ID;
if (!runId || !/^[\w-]+$/.test(runId)) {
  throw new Error('Run mutation testing through node scripts/testing/mutation.mjs for bounded execution and retained evidence.');
}

export default {
  $schema: './node_modules/@stryker-mutator/core/schema/stryker-schema.json',
  mutate: policy.mutate,
  testFiles: policy.testFiles,
  concurrency: policy.concurrency,
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.js' },
  coverageAnalysis: 'perTest',
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
