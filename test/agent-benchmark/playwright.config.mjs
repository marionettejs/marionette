import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  testDir: '.',
  testMatch: 'reference-app.spec.mjs',
  retries: 0,
  workers: 1,
  outputDir: '../tmp/agent-reference-app/results',
  reporter: [['list'], ['junit', { outputFile: 'test/tmp/agent-reference-app/results.xml' }],
    ['html', { outputFolder: 'test/tmp/agent-reference-app/report', open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4178', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: ['chromium', 'firefox', 'webkit'].map(browserName => ({ name: browserName, use: { browserName } })),
  webServer: {
    command: 'node scripts/agent-benchmark/serve.mjs',
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    url: 'http://127.0.0.1:4178',
    reuseExistingServer: false,
    timeout: 120000
  }
});
