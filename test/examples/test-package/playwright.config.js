import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './playwright',
  outputDir: '../../tmp/test-package/playwright',
  use: {
    baseURL: 'http://127.0.0.1:4187/gallery/index.html', serviceWorkers: 'block',
    launchOptions: { executablePath: process.env.MNJS_TEST_CHROMIUM_EXECUTABLE }
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:4187/gallery/index.html', reuseExistingServer: false }
});
