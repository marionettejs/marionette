import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'dom', environment: 'jsdom', include: ['*.spec.js'] } },
      { test: {
        name: 'browser', include: ['*.spec.js'], exclude: ['cypress-contract-model.spec.js'],
        browser: {
          enabled: true, headless: true,
          provider: playwright({ launchOptions: { executablePath: process.env.MNJS_TEST_CHROMIUM_EXECUTABLE } }),
          instances: [{ browser: 'chromium' }]
        }
      } }
    ]
  }
});
