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
} });

test('installed TypeScript starter releases old owners across repeated Vite edits', async({ page }, testInfo) => {
  test.setTimeout(600_000);
  const candidate = JSON.parse(await readFile(process.env.MARIONETTE_BROWSER_CANDIDATE, 'utf8'));
  const core = candidate.packages.find(entry => entry.id === 'core');
  let directory = await mkdtemp(join(tmpdir(), 'marionette-starter-dev-'));
  let server;
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    // Build the downloadable kit, move it, then use its documented npm ci path.
    for (const entry of candidate.packages) {
      await cp(entry.artifact, join(directory, entry.tarball.file));
    }
    expect(testInfo.config.projects.map(project => project.name)).toContain('chromium');
    if (testInfo.project.name === 'chromium') {
      // Exercise the npm-distributed directory, not the candidate kit template.
      // Before publication, exact tarballs stand in for the unavailable registry
      // version without rewriting the starter's declared version dependencies.
      const npmStarter = join(directory, 'npm-starter');
      await cp(join(core.directory, 'dist/docs/starter'), npmStarter, { recursive: true });
      expect(await readdir(npmStarter)).not.toContain('package-lock.json');
      await rename(join(npmStarter, 'gitignore'), join(npmStarter, '.gitignore'));
      expect(await readFile(join(npmStarter, '.gitignore'), 'utf8')).toContain('node_modules/');
      const packagedManifest = JSON.parse(await readFile(join(npmStarter, 'package.json'), 'utf8'));
      expect(packagedManifest.dependencies).toEqual({ marionette: core.version, '@mnjs/data': core.version });
      expect(packagedManifest.allowScripts[`marionette@${core.version}`]).toBe(false);
      // npm matches file identities separately from registry name/version rules.
      packagedManifest.allowScripts[core.artifact] = false;
      const manifest = `${JSON.stringify(packagedManifest, null, 2)}\n`;
      await writeFile(join(npmStarter, 'package.json'), manifest);
      await execute(process.execPath, [process.env.npm_execpath, 'install', '--no-save',
        ...candidate.packages.filter(entry => entry.id !== 'adapters').map(entry => entry.artifact)], {
        cwd: npmStarter, timeout: 90_000, maxBuffer: 2 * 1024 * 1024,
        env: { ...process.env, npm_config_audit: 'false', npm_config_fund: 'false' }
      });
      expect(await readFile(join(npmStarter, 'package.json'), 'utf8')).toBe(manifest);
      expect(await readdir(join(npmStarter, 'node_modules/@mnjs'))).not.toContain('adapters');
      await execute(process.execPath, [process.env.npm_execpath, 'run', 'validate'], {
        cwd: npmStarter, timeout: 60_000, maxBuffer: 2 * 1024 * 1024
      });
      await execute(process.execPath, [process.env.npm_execpath, 'run', 'browser:install'], {
        cwd: npmStarter, timeout: 90_000, maxBuffer: 2 * 1024 * 1024
      });
      await execute(process.execPath, [process.env.npm_execpath, 'run', 'test:browser'], {
        cwd: npmStarter, timeout: 60_000, maxBuffer: 2 * 1024 * 1024
      });
      await rm(npmStarter, { recursive: true, force: true });
    }
    const report = await buildDevelopmentKit({
      source: join(core.directory, 'dist/docs/starter'),
      toolingLock: new URL('../fixtures/data-package-starter/package-lock.json', import.meta.url), artifactDir: directory,
      packages: candidate.packages, sourceCommit: candidate.source?.commit || 'local',
      npmCli: process.env.npm_execpath
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

    const sourcePath = join(starter, 'workspace.ts');
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
      await writeFile(sourcePath, source.replace('<h1>Notes</h1>', `<h1>${title}</h1>`));
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
