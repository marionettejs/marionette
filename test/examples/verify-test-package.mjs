import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { basename, delimiter, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';

const root = resolve(import.meta.dirname, '../..');
const { values } = parseArgs({ options: {
  output: { type: 'string', default: join(root, 'test/tmp/test-package-consumer') },
  browser: { type: 'boolean', default: false },
  cypress: { type: 'boolean', default: false },
  artifact: { type: 'string' },
  sha256: { type: 'string' }
} });
const output = resolve(values.output);
mkdirSync(output, { recursive: true });
let workspace;
let consumer;
const fixture = join(root, 'packages/test/examples');
const npmCli = process.env.npm_execpath;
const env = {
  ...process.env,
  NPM_CONFIG_CACHE: process.env.NPM_CONFIG_CACHE ?? join(root, 'test/tmp/npm-cache'),
  NODE_PATH: '',
  CYPRESS_INSTALL_BINARY: '0',
  NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --no-global-search-paths`,
  PATH: (process.env.PATH || '').split(delimiter).filter(path => !path.includes('node_modules')).join(delimiter)
};
const report = { artifact: undefined, sha256: undefined, node: process.version,
  requestedChecks: { browser: values.browser, cypress: values.cypress }, stages: [], passed: false };
function run(name, command, args, cwd = consumer) {
  const stage = { name, passed: false };
  report.stages.push(stage);
  try {
    const result = execFileSync(command, args, { cwd, env, encoding: 'utf8', timeout: 180000, stdio: ['ignore', 'pipe', 'pipe'] });
    writeFileSync(join(output, `${name}.log`), result);
    stage.passed = true;
    console.log(`${name}: passed`);
    return result;
  } catch (error) {
    writeFileSync(join(output, `${name}.log`), `${error.stdout ?? ''}\n${error.stderr ?? ''}`);
    throw error;
  }
}
function runNpm(name, args, cwd = consumer) { return run(name, process.execPath, [npmCli, ...args], cwd); }
function assertIsolated(directory) {
  for (let ancestor = dirname(realpathSync(directory)); ; ancestor = dirname(ancestor)) {
    assert(!existsSync(join(ancestor, 'node_modules')), `Fixture ancestor contains node_modules: ${ancestor}`);
    if (dirname(ancestor) === ancestor) { return; }
  }
}
try {
  if (!npmCli) { throw new Error('Run helper consumer verification through npm so its CLI can be located.'); }
  assert.equal(Boolean(values.artifact), Boolean(values.sha256), 'Supply --artifact and --sha256 together.');
  const fixtureManifest = JSON.parse(readFileSync(join(fixture, 'package.json'), 'utf8'));
  const expectedVersions = {
    marionette: fixtureManifest.dependencies.marionette,
    helper: JSON.parse(readFileSync(join(root, 'packages/test/package.json'), 'utf8')).version,
    playwright: fixtureManifest.devDependencies['@playwright/test']
  };
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const sourceDirty = Boolean(execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, encoding: 'utf8' }).trim());
  const sourceFiles = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--',
    'packages/test', 'test/examples', 'build/declarations.mjs', 'package.json', 'vitest.config.js', 'test/README.md'],
  { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean).sort().map(path => {
    try { return { path, sha256: createHash('sha256').update(readFileSync(join(root, path))).digest('hex') }; } catch (error) {
      if (error.code === 'ENOENT') { return { path, deleted: true }; }
      throw error;
    }
  });
  Object.assign(report, { sourceRevision, sourceDirty, sourceFiles,
    sourceFilesSha256: createHash('sha256').update(JSON.stringify(sourceFiles)).digest('hex'),
    lockSha256: createHash('sha256').update(readFileSync(join(fixture, 'package-lock.json'))).digest('hex') });
  workspace = mkdtempSync(join(tmpdir(), 'mnjs-test-consumer-'));
  consumer = join(workspace, 'packages/test/examples');
  let artifact;
  if (values.artifact) {
    const supplied = resolve(values.artifact);
    artifact = join(output, basename(supplied));
    if (artifact !== supplied) { cpSync(supplied, artifact); }
    report.sha256 = createHash('sha256').update(readFileSync(artifact)).digest('hex');
    assert.equal(report.sha256, values.sha256, 'Supplied archive SHA256 mismatch.');
    report.artifactMode = 'supplied';
  } else {
    const packed = JSON.parse(runNpm('pack', ['pack', './packages/test', '--ignore-scripts', '--json', '--pack-destination', output], root))[0];
    artifact = join(output, packed.filename);
    report.sha256 = createHash('sha256').update(readFileSync(artifact)).digest('hex');
    report.artifactMode = 'packed';
  }
  report.artifact = basename(artifact);
  const paths = execFileSync('tar', ['-tzf', artifact], { encoding: 'utf8' }).trim().split('\n');
  assert(paths.every(path => /^package\/(dist\/|readme\.md$|license\.txt$|package\.json$)/.test(path)), 'Unexpected archive contents.');
  mkdirSync(join(workspace, 'packages/test'), { recursive: true });
  run('extract', 'tar', ['-xzf', artifact, '--strip-components=1', '-C', join(workspace, 'packages/test')], workspace);
  const installedManifest = JSON.parse(readFileSync(join(workspace, 'packages/test/package.json'), 'utf8'));
  assert.equal(installedManifest.name, '@mnjs/test');
  assert.equal(installedManifest.version, expectedVersions.helper);
  cpSync(fixture, consumer, { recursive: true, filter: path => !path.split('/').includes('node_modules') });
  assertIsolated(consumer);
  const originalLock = readFileSync(join(fixture, 'package-lock.json'), 'utf8');
  // Change only the helper's local locator/integrity; keep every external pin intact.
  const locator = 'file:../artifact.tgz';
  cpSync(artifact, join(workspace, 'packages/test/artifact.tgz'));
  const consumerManifest = JSON.parse(readFileSync(join(consumer, 'package.json'), 'utf8'));
  consumerManifest.dependencies['@mnjs/test'] = locator;
  writeFileSync(join(consumer, 'package.json'), `${JSON.stringify(consumerManifest, null, 2)}\n`);
  const consumerLock = JSON.parse(originalLock);
  consumerLock.packages[''].dependencies['@mnjs/test'] = locator;
  consumerLock.packages['node_modules/@mnjs/test'].resolved = locator;
  report.archiveIntegrity = `sha512-${createHash('sha512').update(readFileSync(artifact)).digest('base64')}`;
  consumerLock.packages['node_modules/@mnjs/test'].integrity = report.archiveIntegrity;
  const lockedConsumer = `${JSON.stringify(consumerLock, null, 2)}\n`;
  writeFileSync(join(consumer, 'package-lock.json'), lockedConsumer);
  report.consumerLockSha256 = createHash('sha256').update(lockedConsumer).digest('hex');
  runNpm('install', ['ci', '--ignore-scripts']);
  assert.equal(readFileSync(join(consumer, 'package-lock.json'), 'utf8'), lockedConsumer);
  run('installed-copy', process.execPath, ['--input-type=module', '-e',
    'import assert from "node:assert/strict"; import { createRequire } from "node:module"; import { resolve } from "node:path";' +
    'const require = createRequire(import.meta.url);' +
    'for (const name of ["@mnjs/test", "marionette"]) {' +
    'const path = require.resolve(`${name}/package.json`);' +
    'assert.equal(path, resolve(`node_modules/${name}/package.json`)); console.log(`${name}: ${path}`); }']);
  run('versions', process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const actual = {
      marionette: require('marionette/package.json').version,
      helper: require('@mnjs/test/package.json').version,
      playwright: require('@playwright/test/package.json').version
    };
    assert.deepEqual(actual, JSON.parse(process.argv[1]));
    console.log(JSON.stringify(actual));
  `, JSON.stringify(expectedVersions)]);
  run('import-without-dom', process.execPath, ['--input-type=module', '-e', 'import assert from \'node:assert/strict\';import * as esm from \'@mnjs/test\';import {createRequire} from \'node:module\';const cjs=createRequire(import.meta.url)(\'@mnjs/test\');assert.deepEqual(Object.keys(esm).sort(),[\'createTestScope\',\'mountApplication\',\'mountView\']);assert.deepEqual(Object.keys(cjs).sort(),Object.keys(esm).sort());await esm.createTestScope().cleanup();']);
  cpSync(join(root, 'test/examples/optional-test-peers.mjs'), join(consumer, 'optional-test-peers.mjs'));
  run('optional-peer-isolation', process.execPath, ['optional-test-peers.mjs']);
  cpSync(join(root, 'test/examples/test-readme.mjs'), join(consumer, 'test-readme.mjs'));
  run('readme-recipes', process.execPath, ['--import', './dom.js', 'test-readme.mjs']);
  runNpm('runtime-and-types', ['run', 'test:consumer']);
  runNpm('vitest-dom', ['test']);
  if (values.browser) {
    report.browser = JSON.parse(run('browser-version', process.execPath, ['--input-type=module', '-e',
      'import { chromium } from \'playwright\'; const executable = process.env.MNJS_TEST_CHROMIUM_EXECUTABLE; const browser = await chromium.launch({executablePath: executable}); console.log(JSON.stringify({executable: executable ?? null, version: browser.version()})); await browser.close();']));
    runNpm('vitest-browser', ['run', 'test:browser']);
    runNpm('playwright-gallery', ['run', 'test:playwright']);
  }
  if (values.cypress) {
    cpSync(join(root, 'test/examples/cypress-smoke.mjs'), join(consumer, 'cypress-smoke.mjs'));
    try { run('cypress-runtime', process.execPath, ['cypress-smoke.mjs']); } finally {
      const diagnostics = join(consumer, 'test-results/cypress');
      if (existsSync(diagnostics)) { cpSync(diagnostics, join(output, 'cypress'), { recursive: true }); }
    }
  }
  report.passed = true;
} catch (error) {
  report.error = error.message;
  console.error(report.error);
  process.exitCode = 1;
} finally {
  try { writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n'); } finally {
    if (workspace) { rmSync(workspace, { recursive: true, force: true }); }
  }
}
