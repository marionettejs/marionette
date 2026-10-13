import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';

const root = resolve(import.meta.dirname, '../..');
const { values } = parseArgs({ options: {
  output: { type: 'string', default: join(root, 'test/tmp/test-package-consumer') },
  browser: { type: 'boolean', default: false }
} });
const output = resolve(values.output);
mkdirSync(output, { recursive: true });
const workspace = mkdtempSync(join(tmpdir(), 'mnjs-test-consumer-'));
const consumer = join(workspace, 'packages/test/examples');
const fixture = join(root, 'packages/test/examples');
const npmCli = process.env.npm_execpath;
if (!npmCli) { throw new Error('Run helper consumer verification through npm so its CLI can be located.'); }
const env = {
  ...process.env,
  NPM_CONFIG_CACHE: process.env.NPM_CONFIG_CACHE ?? join(root, 'test/tmp/npm-cache'),
  NODE_PATH: '',
  NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --no-global-search-paths`,
  PATH: (process.env.PATH || '').split(delimiter).filter(path => !path.includes('node_modules')).join(delimiter)
};
const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const sourceDirty = Boolean(execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, encoding: 'utf8' }).trim());
const sourceFiles = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--',
  'packages/test', 'test/examples', 'build/declarations.mjs', 'package.json', 'vitest.config.js', 'test/README.md'],
{ cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean).sort().map(path => ({
  path, sha256: createHash('sha256').update(readFileSync(join(root, path))).digest('hex')
}));
const report = { artifact: undefined, sha256: undefined, sourceRevision,
  sourceDirty, sourceFiles, sourceFilesSha256: createHash('sha256').update(JSON.stringify(sourceFiles)).digest('hex'),
  lockSha256: createHash('sha256').update(readFileSync(join(fixture, 'package-lock.json'))).digest('hex'),
  node: process.version, stages: [], passed: false };
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
  const packed = JSON.parse(runNpm('pack', ['pack', './packages/test', '--ignore-scripts', '--json', '--pack-destination', output], root))[0];
  const artifact = join(output, packed.filename);
  report.artifact = packed.filename;
  report.sha256 = createHash('sha256').update(readFileSync(artifact)).digest('hex');
  assert(packed.files.every(file => /^(dist\/|readme\.md$|license\.txt$|package\.json$)/.test(file.path)));
  mkdirSync(join(workspace, 'packages/test'), { recursive: true });
  run('extract', 'tar', ['-xzf', artifact, '--strip-components=1', '-C', join(workspace, 'packages/test')], workspace);
  cpSync(fixture, consumer, { recursive: true, filter: path => !path.split('/').includes('node_modules') });
  assertIsolated(consumer);
  const originalLock = readFileSync(join(fixture, 'package-lock.json'), 'utf8');
  runNpm('install', ['ci', '--ignore-scripts', '--install-links']);
  assert.equal(readFileSync(join(consumer, 'package-lock.json'), 'utf8'), originalLock);
  run('installed-copy', process.execPath, ['--input-type=module', '-e',
    'import assert from "node:assert/strict"; import { createRequire } from "node:module"; import { resolve } from "node:path";' +
    'const require = createRequire(import.meta.url);' +
    'for (const name of ["@mnjs/test", "marionette"]) {' +
    'const path = require.resolve(`${name}/package.json`);' +
    'assert.equal(path, resolve(`node_modules/${name}/package.json`)); console.log(`${name}: ${path}`); }']);
  run('versions', process.execPath, ['-e', 'const assert=require(\'node:assert/strict\');assert.equal(require(\'marionette/package.json\').version,\'5.0.0\');assert.equal(require(\'@mnjs/test/package.json\').version,\'0.1.0\');assert.equal(require(\'@playwright/test/package.json\').version,\'1.63.0\');console.log(JSON.stringify({marionette:require(\'marionette/package.json\').version,helper:require(\'@mnjs/test/package.json\').version,playwright:require(\'@playwright/test/package.json\').version}));']);
  run('import-without-dom', process.execPath, ['--input-type=module', '-e', 'import assert from \'node:assert/strict\';import * as esm from \'@mnjs/test\';import {createRequire} from \'node:module\';const cjs=createRequire(import.meta.url)(\'@mnjs/test\');assert.deepEqual(Object.keys(esm).sort(),[\'createTestScope\',\'mountApplication\',\'mountView\']);assert.deepEqual(Object.keys(cjs).sort(),Object.keys(esm).sort());await esm.createTestScope().cleanup();']);
  runNpm('runtime-and-types', ['run', 'test:consumer']);
  runNpm('vitest-dom', ['test']);
  if (values.browser) {
    report.browser = JSON.parse(run('browser-version', process.execPath, ['--input-type=module', '-e',
      'import { chromium } from \'playwright\'; const executable = process.env.MNJS_TEST_CHROMIUM_EXECUTABLE; const browser = await chromium.launch({executablePath: executable}); console.log(JSON.stringify({executable: executable ?? null, version: browser.version()})); await browser.close();']));
    runNpm('vitest-browser', ['run', 'test:browser']);
    runNpm('playwright-gallery', ['run', 'test:playwright']);
  }
  report.passed = true;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  rmSync(workspace, { recursive: true, force: true });
}
