import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'reference-app.spec.mjs',
  retries: 0,
  workers: 1,
  outputDir: '../tmp/agent-reference-app',
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4178', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: ['chromium', 'firefox', 'webkit'].map(browserName => ({ name: browserName, use: { browserName } })),
  webServer: {
    command: 'node scripts/agent-benchmark/serve.mjs',
    cwd: new URL('../..', import.meta.url).pathname,
    url: 'http://127.0.0.1:4178',
    reuseExistingServer: false,
    timeout: 120000
  }
});
