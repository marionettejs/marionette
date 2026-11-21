import { defineConfig } from '@playwright/test';
import base from './playwright.config.mjs';
import { routerBrowserProjects } from './test/router/browser-policy.mjs';

export default defineConfig({
  ...base,
  testMatch: '**/router-*.spec.mjs',
  globalSetup: './test/router/browser-setup.mjs',
  outputDir: './test/tmp/router-browser/results',
  reporter: [['list'], ['json', { outputFile: './test/tmp/router-browser/results.json' }]],
  projects: routerBrowserProjects,
});
