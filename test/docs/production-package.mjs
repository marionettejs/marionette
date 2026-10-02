import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { chromium, firefox, webkit, expect } from '@playwright/test';
import { releasePackages } from '../../scripts/release/packages.mjs';

const root = resolve(import.meta.dirname, '../..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

// An explicit local hosting policy, not a generic SPA fallback or remote-edge proof.
export async function createProductionServer({ directory, records, retainedDirectories = [] }) {
  const control = { directory, retainedDirectories, mode: 'ready', pending: new Set(), requests: [], aborted: 0 };
  const server = createServer(async(request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    control.requests.push(pathname);
    try {
      if (pathname === '/records') {
        response.writeHead(308, { location: '/records/', 'cache-control': 'no-cache' });
        response.end();
        return;
      }
      if (pathname === '/api/records.json') {
        response.setHeader('cache-control', 'no-store');
        response.setHeader('content-type', 'application/json');
        if (control.mode === 'failure') {
          response.writeHead(503); response.end('{"error":"Unavailable"}'); return;
        }
        if (control.mode === 'pending') {
          control.pending.add(response);
          response.once('close', () => {
            if (control.pending.delete(response)) { control.aborted++; }
          });
          return;
        }
        response.end(records);
        return;
      }
      const path = pathname === '/records/' ? 'index.html' :
        /^\/records\/assets\/[\w.-]+\.(?:js|css)$/.test(pathname) ? pathname.slice('/records/'.length) : undefined;
      if (!path) { response.writeHead(404, { 'content-type': 'text/plain' }); response.end('Not found'); return; }
      let bytes;
      for (const source of path === 'index.html' ? [control.directory] : [control.directory, ...control.retainedDirectories]) {
        try { bytes = await readFile(join(source, path)); break; } catch (error) {
          if (error.code !== 'ENOENT') { throw error; }
        }
      }
      if (!bytes) { response.writeHead(404, { 'content-type': 'text/plain' }); response.end('Not found'); return; }
      response.setHeader('content-type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[extname(path)]);
      response.setHeader('cache-control', path === 'index.html' ? 'no-cache' : 'public, max-age=31536000, immutable');
      if (path === 'index.html') {
        const etag = `"${hash(bytes)}"`;
        response.setHeader('etag', etag);
        if (request.headers['if-none-match'] === etag) { response.writeHead(304); response.end(); return; }
      }
      response.end(bytes);
    } catch (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'content-type': 'text/plain' });
      response.end(error.code === 'ENOENT' ? 'Not found' : error.message);
    }
  });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  return {
    control,
    origin: `http://127.0.0.1:${server.address().port}`,
    settlePending() {
      for (const response of control.pending) {
        control.pending.delete(response);
        if (!response.destroyed) { response.end(records); }
      }
    },
    async close() {
      for (const response of control.pending) { response.destroy(); }
      control.pending.clear();
      server.closeAllConnections();
      await new Promise(done => server.close(done));
    },
  };
}

async function artifactInputs(directory) {
  const files = (await readdir(directory)).filter(file => file.endsWith('.tgz'));
  const packages = [];
  for (const file of files) {
    const path = join(directory, file);
    const manifest = JSON.parse(execFileSync('tar', ['-xOf', path, 'package/package.json'], { encoding: 'utf8' }));
    if (releasePackages.some(entry => entry.name === manifest.name)) {
      packages.push({ name: manifest.name, version: manifest.version, file: path,
        sha256: hash(await readFile(path)), manifest });
    }
  }
  assert.equal(packages.length, releasePackages.length, 'Supply exactly one tarball for each of the five packages');
  for (const entry of releasePackages) { assert.equal(packages.filter(pkg => pkg.name === entry.name).length, 1); }
  assert.equal(new Set(packages.map(pkg => pkg.version)).size, 1, 'Candidate package versions must match');
  const evidenceFile = join(directory, 'release-evidence.json');
  const evidence = await readFile(evidenceFile, 'utf8').catch(error => {
    if (error.code === 'ENOENT') { return undefined; }
    throw error;
  });
  if (evidence) {
    for (const entry of JSON.parse(evidence).packages) {
      assert.equal(packages.find(pkg => pkg.name === entry.name)?.sha256, entry.tarball.sha256);
    }
  }
  return { packages, evidenceSha256: evidence ? hash(evidence) : undefined };
}

export async function verifyProductionPackage({ artifactDirectory, reportPath, engines = ['chromium', 'firefox', 'webkit'] }) {
  assert(engines.length && new Set(engines).size === engines.length && engines.every(engine => ['chromium', 'firefox', 'webkit'].includes(engine)), 'Select unique supported browser engines');
  const workspace = await realpath(await mkdtemp(join(tmpdir(), 'marionette-production-')));
  const report = { schemaVersion: 1, passed: false, node: process.version, startedAt: new Date().toISOString(), checks: [], browsers: [] };
  report.harnessSha256 = hash(await readFile(import.meta.filename));
  const logs = [];
  let hosting;
  try {
    const input = await artifactInputs(artifactDirectory);
    report.artifacts = input.packages;
    report.releaseEvidenceSha256 = input.evidenceSha256;
    report.artifactScope = input.evidenceSha256 ? 'Candidate package hashes checked against supplied release evidence; this harness does not certify a release.' : 'Explicit candidate tarballs without a release-evidence manifest; package/bundle verification only.';
    const dependencies = Object.fromEntries(input.packages.map(pkg => [pkg.name, `file:${pkg.file}`]));
    await writeFile(join(workspace, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: {
      ...dependencies, 'lit-html': '3.3.3', vite: '8.3.0',
    } }, null, 2));
    const run = (command, args, cwd = workspace) => {
      const output = execFileSync(command, args, { cwd, encoding: 'utf8', timeout: 120_000,
        env: { ...process.env, NODE_PATH: '', NODE_OPTIONS: '--no-global-search-paths' } });
      logs.push({ command, args, output });
      return output;
    };
    const npmArgs = ['install', '--ignore-scripts', '--no-audit', '--no-fund'];
    if (process.env.npm_execpath) { run(process.execPath, [process.env.npm_execpath, ...npmArgs]); } else { run('npm', npmArgs); }
    report.consumerLockSha256 = hash(await readFile(join(workspace, 'package-lock.json')));
    report.tooling = Object.fromEntries(await Promise.all(['vite', 'lit-html'].map(async name => [name,
      JSON.parse(await readFile(join(workspace, 'node_modules', name, 'package.json'))).version])));
    for (const pkg of input.packages) {
      const installed = join(workspace, 'node_modules', pkg.name);
      assert.equal(await realpath(installed), installed, 'Installed candidate must not link to repository source');
      assert.equal(JSON.parse(await readFile(join(installed, 'package.json'))).version, pkg.version);
    }
    const core = join(workspace, 'node_modules/marionette');
    const manifestBytes = await readFile(join(core, 'docs-manifest.json'));
    const docsManifest = JSON.parse(manifestBytes);
    report.docs = { manifestSha256: hash(manifestBytes), sourceRevision: docsManifest.sourceRevision,
      sourceDirty: docsManifest.sourceDirty, contentSha256: docsManifest.contentSha256 };
    const delivered = join(core, 'examples/records');
    const app = join(workspace, 'app');
    await mkdir(app);
    for (const path of ['src', 'public', 'index.html', 'vite.config.js']) { await cp(join(delivered, path), join(app, path), { recursive: true }); }
    const sourceFiles = docsManifest.assets.filter(asset => asset.source.startsWith('examples/records/'));
    assert(sourceFiles.some(asset => asset.source === 'examples/records/src/main.js'), 'Candidate must include the actual records source');
    report.recordsSource = sourceFiles.map(asset => ({ source: asset.source, sha256: asset.sha256 }));
    for (const source of sourceFiles) { assert.equal(hash(await readFile(join(core, source.source))), source.sha256); }
    const vite = join(workspace, 'node_modules/vite/bin/vite.js');
    const buildConfig = join(workspace, 'production.config.mjs');
    await writeFile(buildConfig, `
import original from './app/vite.config.js';
export default {
  ...original,
  plugins: [...(original.plugins || []), {
    name: 'record-installed-module-graph',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'module-graph.json', source: JSON.stringify([...this.getModuleIds()]) });
    },
  }],
};
`);
    run(process.execPath, [vite, 'build', '--base=/records/', '--config', buildConfig], app);
    const buildA = join(workspace, 'build-a');
    await cp(join(app, 'dist'), buildA, { recursive: true });
    // A small real CSS change in the copied consumer produces a second hashed build.
    const styles = join(app, 'src/styles.css');
    await writeFile(styles, `${await readFile(styles, 'utf8')}\nhtml { --deployment-check: updated; }\n`);
    run(process.execPath, [vite, 'build', '--base=/records/', '--config', buildConfig], app);
    const buildB = join(app, 'dist');
    report.builds = [];
    for (const [id, directory] of [['initial', buildA], ['updated', buildB]]) {
      const files = ['index.html', ...(await readdir(join(directory, 'assets'))).map(file => `assets/${file}`)];
      const modules = JSON.parse(await readFile(join(directory, 'module-graph.json')));
      const normalizedWorkspace = workspace.replaceAll('\\', '/');
      for (const moduleId of modules.filter(module => !module.startsWith('\0'))) {
        const path = moduleId.split('?')[0].replaceAll('\\', '/');
        assert(path.startsWith(`${normalizedWorkspace}/app/`) || path.startsWith(`${normalizedWorkspace}/node_modules/`), `Bundle module escapes installed consumer: ${moduleId}`);
      }
      for (const pkg of input.packages) {
        assert(modules.some(module => module.includes(`/node_modules/${pkg.name}/dist/`)), `Bundle must consume installed ${pkg.name} distribution`);
      }
      report.builds.push({ id, modules: modules.map(module => module.replace(normalizedWorkspace, '<consumer>')),
        files: await Promise.all(files.map(async file => ({ file, sha256: hash(await readFile(join(directory, file))) }))) });
    }
    assert.notDeepEqual(report.builds[0].files, report.builds[1].files);
    const records = await readFile(join(app, 'public/api/records.json'), 'utf8');
    const rows = JSON.parse(records);
    hosting = await createProductionServer({ directory: buildA, records, retainedDirectories: [buildA] });
    const { origin, control } = hosting;
    const canonical = await fetch(`${origin}/records`, { redirect: 'manual' });
    assert.equal(canonical.status, 308); assert.equal(canonical.headers.get('location'), '/records/');
    const htmlResponse = await fetch(`${origin}/records/`);
    assert.equal(htmlResponse.headers.get('cache-control'), 'no-cache');
    const html = await htmlResponse.text();
    const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(match => match[1]);
    assert(assets.length >= 2);
    for (const asset of assets) {
      assert(asset.startsWith('/records/assets/'));
      const response = await fetch(`${origin}${asset}`);
      assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /immutable/);
    }
    for (const path of ['/records/assets/missing.js', '/api/missing.json', '/records/unknown', '/']) {
      const response = await fetch(`${origin}${path}`);
      assert.equal(response.status, 404); assert.equal(await response.text(), 'Not found');
    }
    report.checks.push('canonical subpath entry', 'base-aware hashed assets', 'installed distribution module graphs', 'HTML revalidation and immutable asset headers', 'missing paths/API/assets remain 404');
    for (const engine of engines) {
      assert(['chromium', 'firefox', 'webkit'].includes(engine));
      control.directory = buildA; control.mode = 'ready';
      const browser = await ({ chromium, firefox, webkit }[engine]).launch();
      try {
        const context = await browser.newContext();
        const page = await context.newPage();
        page.setDefaultTimeout(10_000);
        const errors = [];
        const networkErrors = [];
        const expectedFailures = new Set();
        const expectedAborts = new Set();
        const observedExpected = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => {
          if (request.url() !== `${origin}/api/records.json`) { return; }
          if (control.mode === 'failure') { expectedFailures.add(request); }
          if (control.mode === 'pending') { expectedAborts.add(request); }
        });
        page.on('response', response => {
          if (response.status() < 400) { return; }
          if (response.status() === 503 && expectedFailures.has(response.request())) {
            observedExpected.push({ kind: 'response', status: 503 }); return;
          }
          networkErrors.push({ kind: 'response', url: response.url(), status: response.status() });
        });
        page.on('requestfailed', request => {
          const message = request.failure()?.errorText;
          if (expectedAborts.has(request) && /abort|cancel|NS_BINDING_ABORTED/i.test(message)) {
            observedExpected.push({ kind: 'cancelled pending API request', message }); return;
          }
          networkErrors.push({ kind: 'requestfailed', url: request.url(), message });
        });
        await page.goto(`${origin}/records/`);
        await expect(page.getByRole('status')).toHaveText(`${rows.length} records`);
        const first = page.getByRole('button', { name: rows[0].title, exact: true });
        await first.focus(); await page.keyboard.press('Enter');
        await expect(first).toBeFocused(); await expect(first).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByRole('heading', { name: rows[0].title, exact: true })).toBeVisible();
        await page.reload();
        await expect(page.getByRole('status')).toHaveText(`${rows.length} records`);
        control.mode = 'failure';
        await page.reload();
        await expect(page.getByRole('alert')).toHaveText('Could not open records.');
        control.mode = 'ready';
        await page.getByRole('button', { name: 'Retry', exact: true }).click();
        await expect(page.getByRole('status')).toHaveText(`${rows.length} records`);
        await expect(page.getByRole('alert')).toHaveCount(0);
        assert(observedExpected.some(event => event.status === 503), 'Startup failure must exercise the intentional HTTP 503');
        control.mode = 'pending';
        const abortedBefore = control.aborted;
        await page.reload();
        await expect(page.getByRole('status')).toHaveText('Loading records…');
        await expect.poll(() => control.pending.size).toBeGreaterThan(0);
        await page.getByRole('button', { name: 'Close records', exact: true }).click();
        await expect(page.getByRole('status')).toHaveCount(0);
        await expect(page.getByRole('list', { name: 'Records', exact: true })).toHaveCount(0);
        await expect.poll(() => control.aborted).toBeGreaterThan(abortedBefore);
        hosting.settlePending();
        await page.waitForLoadState('networkidle');
        await expect(page.getByRole('status')).toHaveCount(0);
        await expect(page.getByRole('list', { name: 'Records', exact: true })).toHaveCount(0);
        await expect(page.getByRole('alert')).toHaveCount(0);
        control.mode = 'ready';
        await page.getByRole('button', { name: 'Open records', exact: true }).click();
        await expect(page.getByRole('status')).toHaveText(`${rows.length} records`);
        control.directory = buildB;
        for (const asset of assets) {
          const retained = await fetch(`${origin}${asset}`);
          assert.equal(retained.status, 200, `Previous hashed asset retained: ${asset}`);
          const previous = report.builds[0].files.find(file => `/records/${file.file}` === asset);
          assert.equal(hash(Buffer.from(await retained.arrayBuffer())), previous.sha256);
        }
        await page.reload();
        await expect(page.getByRole('status')).toHaveText(`${rows.length} records`);
        await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--deployment-check').trim())).toBe('updated');
        assert.deepEqual(errors, [], `${engine} must have no uncaught browser errors`);
        assert.deepEqual(networkErrors, [], `${engine} must have no unexpected HTTP or request failures`);
        report.browsers.push({ engine, version: browser.version(), passed: true, observedExpected, checks: [
          'clean served bundle', 'keyboard selection retains focus', 'recognized entry reload',
          'startup failure and retry', 'close pending startup stays closed after settlement, then reopens',
          'previous hashed assets retained', 'updated HTML and hashed CSS after reload', 'unexpected network failures rejected',
        ] });
        await context.close();
      } finally { await browser.close(); }
    }
    report.passed = true;
  } catch (error) {
    report.failure = { message: error.message, stdout: error.stdout?.toString(), stderr: error.stderr?.toString() };
    throw error;
  } finally {
    if (hosting) { await hosting.close(); }
    report.finishedAt = new Date().toISOString();
    report.limits = 'Local HTTP policy with an origin-root API and /records/ static base; prior build assets are explicitly retained. No application router, remote edge/CDN, registry publication, or reader-effectiveness claim. Second build changes only copied CSS; pending transport is genuinely aborted, not an abort-ignoring service simulation.';
    await mkdir(dirname(reportPath), { recursive: true });
    await cp(join(workspace, 'package-lock.json'), join(dirname(reportPath), 'production-consumer-package-lock.json')).catch(() => {});
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    await writeFile(join(dirname(reportPath), 'production-build-logs.json'), `${JSON.stringify(logs, null, 2)}\n`);
    await rm(workspace, { recursive: true, force: true });
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: { 'artifact-dir': { type: 'string' }, report: { type: 'string' }, engines: { type: 'string' } } });
  assert(values['artifact-dir'], 'Supply --artifact-dir containing the five exact candidate tarballs');
  const report = await verifyProductionPackage({ artifactDirectory: resolve(values['artifact-dir']),
    reportPath: resolve(values.report || join(root, 'test/tmp/docs-production/report.json')),
    engines: values.engines ? values.engines.split(',') : undefined });
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, browsers: report.browsers.map(browser => browser.engine) }));
}
