import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  testDir: '.',
  testMatch: 'reference-app.spec.mjs',
  retries: 0,
  workers: 1,
  outputDir: resolve(root, 'test/tmp/agent-reference-app/results'),
  reporter: [['list'], ['junit', { outputFile: resolve(root, 'test/tmp/agent-reference-app/results.xml') }],
    ['html', { outputFolder: resolve(root, 'test/tmp/agent-reference-app/report'), open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4178', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: ['chromium', 'firefox', 'webkit'].map(browserName => ({ name: browserName, use: { browserName } })),
  webServer: {
    command: 'node scripts/agent-benchmark/serve.mjs',
    cwd: root,
    url: 'http://127.0.0.1:4178',
    reuseExistingServer: false,
    timeout: 120000
  }
});
