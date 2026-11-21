import { defineConfig } from '@playwright/test';
import base from './playwright.config.mjs';

// Run original assertions with observation in a separate report. Certification
// keeps the unwrapped native driver and its original promise-observer ordering.
export default defineConfig({
  ...base,
  testMatch: ['**/router-native.spec.mjs', '**/router-authority.spec.mjs'],
  grep: /native Back to a distinct earlier entry|native queued Back dispatch/,
  metadata: { ...base.metadata, routerNativeTrace: true },
  outputDir: './test/tmp/router-diagnostics/results',
  reporter: [['list'], ['json', { outputFile: './test/tmp/router-diagnostics/results.json' }]],
});
