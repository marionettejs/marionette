import { defineConfig } from '@playwright/test';
import base from './playwright.config.mjs';

export default defineConfig({
  ...base,
  testMatch: '**/router-*.spec.mjs',
  globalSetup: './test/router/browser-setup.mjs',
  outputDir: './test/tmp/router-browser/results',
  reporter: [['list'], ['json', { outputFile: './test/tmp/router-browser/results.json' }]],
  projects: [{ name: 'router-chromium', use: { browserName: 'chromium', launchOptions: {
    chromiumSandbox: true,
    ...(process.env.MARIONETTE_ROUTER_CHROMIUM ? { executablePath: process.env.MARIONETTE_ROUTER_CHROMIUM } : {})
  } } }],
});
