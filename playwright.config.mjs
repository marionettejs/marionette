import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/browser',
  testMatch: '**/*.spec.mjs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : 4,
  timeout: 30_000,
  globalSetup: './test/browser/global-setup.mjs',
  outputDir: './test/tmp/browser/results',
  reporter: [
    ['list'],
    ['html', { outputFolder: './test/tmp/browser/report', open: 'never' }],
    ['json', { outputFile: './test/tmp/browser/results.json' }],
    ['junit', { outputFile: './test/tmp/browser/results.xml' }]
  ],
  use: {
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: ['chromium', 'firefox', 'webkit'].map(browserName => ({
    name: browserName,
    use: { browserName }
  }))
});
