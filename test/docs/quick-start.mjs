import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { access, copyFile, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { parseArgs, promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { releasePackages } from '../../scripts/release/packages.mjs';

const execute = promisify(execFile);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const quote = value => `'${value.replaceAll(/'/g, '\'\\\'\'')}'`;

export async function verifyQuickStart({ packageRoot, artifactDirectory, browser = false }) {
  const report = { schemaVersion: 1, passed: false, node: process.version,
    startedAt: new Date().toISOString(), commands: [], packages: [], browsers: [] };
  let workspace;
  let server;
  let serverOutput = '';
  try {
    assert(process.env.npm_execpath, 'Run through npm with npm_execpath available');
    report.stage = 'isolation';
    workspace = await realpath(await mkdtemp(join(tmpdir(), 'marionette-quick-start-')));
    for (let ancestor = dirname(workspace); ; ancestor = dirname(ancestor)) {
      await assert.rejects(access(join(ancestor, 'node_modules')), { code: 'ENOENT' },
        `Consumer ancestor contains node_modules: ${ancestor}`);
      if (dirname(ancestor) === ancestor) { break; }
    }
    const bin = join(workspace, 'bin');
    await mkdir(bin);
    await writeFile(join(bin, 'npm'), `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(process.env.npm_execpath)} "$@"\n`, { mode: 0o755 });
    const userConfig = join(bin, 'npm-user-config');
    const globalConfig = join(bin, 'npm-global-config');
    await writeFile(userConfig, '');
    await writeFile(globalConfig, '');
    const env = { ...process.env, NODE_PATH: '', NODE_OPTIONS: '--no-global-search-paths',
      PATH: [bin, ...(process.env.PATH || '').split(delimiter).filter(path => !path.includes('node_modules'))].join(delimiter),
      ['npm_config_userconfig']: userConfig, ['npm_config_globalconfig']: globalConfig,
      npm_config_audit: 'false', npm_config_fund: 'false', NO_COLOR: '1' };
    report.npm = (await execute(process.execPath, [process.env.npm_execpath, '--version'], { env })).stdout.trim();
    const run = async(command, cwd) => {
      const entry = { command, sha256: hash(command), cwd: cwd === workspace ? '.' : 'marionette-example' };
      report.commands.push(entry);
      try {
        const output = await execute('sh', ['-ec', command], { cwd, env, timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
        entry.outputSha256 = hash(output.stdout + output.stderr);
      } catch (error) {
        entry.output = `${error.stdout || ''}${error.stderr || ''}`;
        throw error;
      }
    };
    report.stage = 'artifacts';
    const artifacts = join(workspace, 'marionette-v5-artifacts');
    await mkdir(artifacts);
    for (const file of (await readdir(artifactDirectory)).filter(name => name.endsWith('.tgz')).sort()) {
      const path = join(artifactDirectory, file);
      const { stdout } = await execute('tar', ['-xOf', path, 'package/package.json'], { encoding: 'utf8' });
      const manifest = JSON.parse(stdout);
      assert(releasePackages.some(entry => entry.name === manifest.name), `Unexpected candidate tarball: ${file}`);
      const bytes = await readFile(path);
      const entry = { name: manifest.name, version: manifest.version, file, sha256: hash(bytes),
        integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}` };
      report.packages.push(entry);
      await copyFile(path, join(artifacts, file));
      assert.equal(hash(await readFile(join(artifacts, file))), entry.sha256);
    }
    assert.equal(report.packages.length, releasePackages.length, 'Supply the five exact candidate tarballs');
    for (const entry of releasePackages) {
      assert.equal(report.packages.filter(pkg => pkg.name === entry.name).length, 1, entry.name);
    }
    assert.equal(new Set(report.packages.map(pkg => pkg.version)).size, 1, 'Candidate versions match');
    const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
    assert.equal(report.packages.find(pkg => pkg.name === 'marionette').version, manifest.version);
    const source = await readFile(join(packageRoot, 'docs/quick-start.md'), 'utf8');
    const fences = language => [...source.matchAll(new RegExp('```' + language + '\\n([\\s\\S]*?)```', 'g'))].map(match => match[1]);
    const commands = fences('sh');
    const html = fences('html');
    const javascript = fences('js');
    assert.equal(commands.length, 2, 'Quick start contains setup and dev commands');
    assert.equal(html.length, 1, 'Quick start contains one complete HTML document');
    assert.equal(javascript.length, 1, 'Quick start contains one complete entry module');
    report.source = { quickStartSha256: hash(source), htmlSha256: hash(html[0]), javascriptSha256: hash(javascript[0]),
      harnessSha256: hash(await readFile(import.meta.filename)) };
    report.stage = 'setup';
    await run(commands[0], workspace);
    const project = join(workspace, 'marionette-example');
    await writeFile(join(project, 'index.html'), html[0]);
    await writeFile(join(project, 'main.js'), javascript[0]);
    report.stage = 'installed-packages';
    const lockBytes = await readFile(join(project, 'package-lock.json'));
    const lock = JSON.parse(lockBytes);
    report.lockSha256 = hash(lockBytes);
    report.packageJsonSha256 = hash(await readFile(join(project, 'package.json')));
    for (const [path, entry] of Object.entries(lock.packages)) {
      const name = path.match(/(?:^|\/)node_modules\/(marionette|@mnjs\/[^/]+)$/)?.[1];
      if (!name) { continue; }
      const pkg = report.packages.find(candidate => candidate.name === name);
      assert(pkg, `Unexpected Marionette package: ${path}`);
      assert.notEqual(name, '@mnjs/data', 'Optional data must remain absent');
      assert.equal(entry.resolved, `file:../marionette-v5-artifacts/${pkg.file}`, path);
      assert.equal(entry.integrity, pkg.integrity, path);
      assert.equal(entry.version, pkg.version, path);
    }
    for (const pkg of report.packages.filter(entry => entry.name !== '@mnjs/data')) {
      const installed = JSON.parse(await readFile(join(project, 'node_modules', pkg.name, 'package.json'), 'utf8'));
      assert.equal(installed.name, pkg.name);
      assert.equal(installed.version, pkg.version);
      assert.equal(lock.packages[`node_modules/${pkg.name}`]?.integrity, pkg.integrity, pkg.name);
      assert.equal(lock.packages[`node_modules/${pkg.name}`]?.version, pkg.version, pkg.name);
      pkg.installed = true;
    }
    assert.throws(() => createRequire(join(project, 'package.json')).resolve('@mnjs/data'), { code: 'MODULE_NOT_FOUND' });
    assert.equal(lock.packages['node_modules/@mnjs/data'], undefined);
    const installedCore = join(project, 'node_modules/marionette');
    assert.equal(await readFile(join(installedCore, 'docs/quick-start.md'), 'utf8'), source);
    const docsManifest = JSON.parse(await readFile(join(installedCore, 'docs-manifest.json'), 'utf8'));
    Object.assign(report.source, { sourceRevision: docsManifest.sourceRevision, sourceDirty: docsManifest.sourceDirty,
      contentSha256: docsManifest.contentSha256 });
    report.stage = 'build';
    await run('npm run build', project);
    report.bundleSha256 = hash(await readFile(join(project, 'dist/index.html')));
    if (browser) {
      report.stage = 'browser';
      const playwright = await import('@playwright/test');
      const command = `${commands[1].trimEnd()} -- --host 127.0.0.1 --port 0`;
      const entry = { command, sha256: hash(command), cwd: 'marionette-example' };
      report.commands.push(entry);
      server = spawn('sh', ['-ec', command], { cwd: project, env, detached: process.platform !== 'win32' });
      const origin = await new Promise((done, reject) => {
        const timer = setTimeout(() => reject(new Error(`Vite did not start: ${serverOutput}`)), 30_000);
        const finish = (error, url) => { clearTimeout(timer); if (error) { reject(error); } else { done(url); } };
        server.once('error', error => finish(error));
        server.once('exit', code => finish(new Error(`Vite exited (${code}): ${serverOutput}`)));
        const receive = chunk => {
          serverOutput += chunk.toString();
          const url = serverOutput.match(/http:\/\/127\.0\.0\.1:\d+\//)?.[0];
          if (url) { finish(undefined, url); }
        };
        server.stdout.on('data', receive);
        server.stderr.on('data', receive);
      });
      for (const engine of ['chromium', 'firefox', 'webkit']) {
        const browserInstance = await playwright[engine].launch();
        try {
          const page = await browserInstance.newPage();
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          await page.goto(origin);
          await playwright.expect(page.getByRole('heading', { name: 'Hello, Marionette', exact: true })).toBeVisible();
          assert.deepEqual(errors, [], engine);
          report.browsers.push({ engine, passed: true });
        } finally {
          await browserInstance.close();
        }
      }
      entry.outputSha256 = hash(serverOutput);
    }
    report.passed = true;
    report.stage = 'complete';
  } catch (error) {
    report.error = String(error.stack || error);
  } finally {
    if (server && server.exitCode === null && server.pid) {
      const exited = new Promise(done => server.once('exit', done));
      if (process.platform === 'win32') { server.kill(); } else { process.kill(-server.pid, 'SIGTERM'); }
      await exited;
    }
    if (workspace) { await rm(workspace, { recursive: true, force: true }); }
    report.finishedAt = new Date().toISOString();
    report.limits = `Supplied local candidate bytes and documented consumer commands${browser ? ', with Vite in Chromium, Firefox and WebKit' : '; browser execution was not requested'}. Does not verify registry publication, website deployment, or reader effectiveness.`;
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values, positionals } = parseArgs({ options: { browser: { type: 'boolean', default: false } }, allowPositionals: true });
  assert.equal(positionals.length, 2, 'Pass installed core package root and the five-tarball artifact directory');
  const report = await verifyQuickStart({ packageRoot: resolve(positionals[0]), artifactDirectory: resolve(positionals[1]), browser: values.browser });
  if (!report.passed) { process.exitCode = 1; }
  console.log(JSON.stringify(report, null, 2));
}
