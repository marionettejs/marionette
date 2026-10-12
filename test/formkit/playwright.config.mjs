import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: ['formkit.spec.mjs', 'composed.spec.mjs'], retries: 0,
  outputDir: '../tmp/formkit-browser',
  reporter: [['list'], ['json', { outputFile: '../tmp/formkit-browser.json' }]],
  use: { baseURL: 'http://127.0.0.1:5184', headless: true },
  projects: ['chromium', 'firefox', 'webkit'].map(browserName => ({ name: browserName, use: { browserName,
    ...(browserName === 'chromium' && process.env.MNJS_TEST_CHROMIUM_EXECUTABLE ?
      { launchOptions: { executablePath: process.env.MNJS_TEST_CHROMIUM_EXECUTABLE } } : {}) } })),
  webServer: { command: 'npm --prefix examples/formkit run dev -- --port 5184 --strictPort',
    cwd: '../..', url: 'http://127.0.0.1:5184', reuseExistingServer: false }
});
