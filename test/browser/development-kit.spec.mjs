import { test, expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { cp, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { createRequire, SourceMap } from 'node:module';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { buildDevelopmentKit, verifyDevelopmentKit } from '../../scripts/docs/development-kit.mjs';

const executeFile = promisify(execFile);
const execute = (file, args, options = {}) => executeFile(file, args, { ...options, env: {
  ...process.env, ...options.env, NODE_PATH: '',
  NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --no-global-search-paths`,
  PATH: (process.env.PATH || '').split(delimiter).filter(path => !path.includes('node_modules')).join(delimiter)
} }).catch(error => {
  error.message += `\n${error.stdout || ''}`;
  throw error;
});

test('installed TypeScript consumer fixture releases old owners across repeated Vite edits', async({ page }) => {
  test.setTimeout(600_000);
  const candidate = JSON.parse(await readFile(process.env.MARIONETTE_BROWSER_CANDIDATE, 'utf8'));
  let directory = await mkdtemp(join(tmpdir(), 'marionette-starter-dev-'));
  let server;
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    // Build the downloadable kit, move it, then use its documented npm ci path.
    for (const entry of candidate.packages) {
      await cp(entry.artifact, join(directory, entry.tarball.file));
    }
    const report = await buildDevelopmentKit({
      source: join(import.meta.dirname, '../fixtures/data-package-starter'),
      toolingLock: new URL('../fixtures/data-package-starter/package-lock.json', import.meta.url), artifactDir: directory,
      packages: candidate.packages, sourceCommit: candidate.source?.commit || 'local',
      npmCli: process.env.npm_execpath,
      sourceFiles: ['package.json', 'AGENTS.md', 'playwright.config.mjs', 'workspace.browser.spec.mjs',
        'gitignore', 'index.html', 'main.ts', 'setup.ts', 'workspace.ts', 'workspace-views.ts',
        'notes.ts', 'workspace.test.mjs', 'readme.md', 'tsconfig.json', 'eslint.config.mjs', 'vite.config.mjs'],
    });
    await verifyDevelopmentKit(directory, report, candidate.source?.commit || 'local');
    await rename(directory, `${directory}-moved`);
    directory = `${directory}-moved`;
    const starter = join(directory, 'starter');
    // GitHub release assets carry the same project in a standalone archive.
    await rm(starter, { recursive: true });
    await execute('tar', ['-xzf', join(directory, 'development-starter.tar.gz'), '-C', directory]);
    await verifyDevelopmentKit(directory, report, candidate.source?.commit || 'local');
    await rename(join(starter, 'gitignore'), join(starter, '.gitignore'));
    await execute(process.execPath, [process.env.npm_execpath, 'ci'], {
      cwd: starter, timeout: 90_000, maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, npm_config_audit: 'false', npm_config_fund: 'false' }
    });
    await execute(process.execPath, [process.env.npm_execpath, 'run', 'validate'], {
      cwd: starter, timeout: 60_000, maxBuffer: 2 * 1024 * 1024
    });
    const bundles = await readdir(join(starter, 'dist/assets'));
    const maps = await Promise.all(bundles.filter(file => file.endsWith('.js.map'))
      .map(async file => JSON.parse(await readFile(join(starter, 'dist/assets', file), 'utf8'))));
    expect(maps.flatMap(map => map.sources).some(source => source.endsWith('/src/modules/view.ts'))).toBe(true);
    expect(maps.flatMap(map => map.sourcesContent).some(source => source?.includes('export interface ViewConfiguration'))).toBe(true);
    const require = createRequire(join(starter, 'package.json'));
    const { createServer } = await import(pathToFileURL(require.resolve('vite')).href);
    server = await createServer({ root: starter, server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
    await server.listen();
    await page.goto(server.resolvedUrls.local[0]);
    const response = await page.request.get(new URL('node_modules/marionette/dist/marionette.js', server.resolvedUrls.local[0]).href);
    expect(response.ok()).toBe(true);
    const module = await response.text();
    const inline = module.match(/sourceMappingURL=data:application\/json[^,]*;base64,([^\s]+)/);
    expect(inline).not.toBeNull();
    const map = new SourceMap(JSON.parse(Buffer.from(inline[1], 'base64').toString()));
    const lines = module.split('\n');
    const diagnosticLine = lines.findIndex(line => line.includes('MN0020'));
    expect(diagnosticLine).toBeGreaterThan(-1);
    const mapped = map.findEntry(diagnosticLine, lines[diagnosticLine].indexOf('MN0020'));
    expect(mapped.originalSource).toMatch(/src\/modules\/view\.ts$/);

    await expect(page.getByRole('heading', { name: 'Notes', exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'Draft title' }).first().fill('Draft survives reorder');
    await page.getByRole('button', { name: 'Reverse rows' }).click();
    await expect(page.getByRole('textbox', { name: 'Draft title' }).last()).toHaveValue('Draft survives reorder');

    const sourcePath = join(starter, 'workspace-views.ts');
    const source = await readFile(sourcePath, 'utf8');
    for (const title of ['Edited once', 'Edited twice']) {
      // Retain the old DOM, and start work which is still pending during replacement.
      await page.evaluate(() => {
        const slowRow = [...document.querySelectorAll('li')].find(row => row.querySelector('input').value !== 'Second note');
        window.oldOpen = slowRow.querySelector('button');
        window.oldStatus = document.querySelector('[role="status"]');
        window.oldOpen.click();
      });
      await expect(page.getByRole('status')).toHaveText('Loading…');
      // Publish a complete edit so Vite cannot reload the file between truncation and writing.
      const editedPath = `${sourcePath}.tmp`;
      await writeFile(editedPath, source.replace('<h1>Notes</h1>', `<h1>${title}</h1>`));
      await rename(editedPath, sourcePath);
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
      await expect(page.getByRole('status')).toHaveText('Choose a note.');
      expect(await page.evaluate(async() => {
        const before = window.oldStatus.textContent;
        window.oldOpen.click();
        // The demo's slow loader waits 600ms. Observe after it could have completed.
        await new Promise(resolve => setTimeout(resolve, 700));
        return { oldStatus: window.oldStatus.textContent, before, detached: !window.oldOpen.isConnected };
      })).toEqual({ oldStatus: 'Loading…', before: 'Loading…', detached: true });
      await expect(page.getByRole('status')).toHaveText('Choose a note.');
      await page.getByRole('button', { name: 'Open', exact: true }).last().click();
      await expect(page.getByRole('heading', { name: 'Selected: second' })).toBeVisible();
      await expect(page.getByRole('status')).toHaveText('Loaded.');
    }
    expect(errors).toEqual([]);
    await page.close(); // Also exercise cleanup when the browser has already closed the page.
  } finally {
    await page.goto('about:blank').catch(() => undefined);
    await server?.close();
    await rm(directory, { recursive: true, force: true });
  }
});
