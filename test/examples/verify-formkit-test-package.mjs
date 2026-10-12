import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';

const root = resolve(import.meta.dirname, '../..');
const { values } = parseArgs({ options: {
  'formkit-tarball': { type: 'string' },
  'formkit-sha256': { type: 'string' },
  'formkit-manifest': { type: 'string' },
  output: { type: 'string', default: join(root, 'test/tmp/formkit-test-package-consumer') },
  browser: { type: 'boolean', default: false }
} });
assert(values['formkit-tarball'] && values['formkit-sha256'] && values['formkit-manifest'],
  'Supply a verified FormKit tarball, its SHA-256 and its source manifest.');
const npmCli = process.env.npm_execpath;
assert(npmCli, 'Run FormKit consumer verification through npm.');
const formkitArtifact = resolve(values['formkit-tarball']);
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
assert.equal(hash(formkitArtifact), values['formkit-sha256'], 'FormKit artifact hash mismatch');
const sourceManifest = JSON.parse(readFileSync(resolve(values['formkit-manifest']), 'utf8'));
const output = resolve(values.output);
mkdirSync(output, { recursive: true });
const workspace = mkdtempSync(join(tmpdir(), 'mnjs-formkit-consumer-'));
const consumer = join(workspace, 'consumer');
const fixture = join(root, 'test/examples/formkit-test-package');
const env = { ...process.env,
  NPM_CONFIG_CACHE: process.env.NPM_CONFIG_CACHE ?? join(root, 'test/tmp/npm-cache'),
  NODE_PATH: '', NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --no-global-search-paths`,
  PATH: (process.env.PATH || '').split(delimiter).filter(path => !path.includes('node_modules')).join(delimiter) };
const report = {
  sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceDirty: Boolean(execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, encoding: 'utf8' }).trim()),
  formkit: { artifact: formkitArtifact, sha256: hash(formkitArtifact), source: sourceManifest },
  independentSuiteSha256: hash(join(fixture, 'independent-application-lifecycle.spec.js')),
  fixtureFiles: ['formkit.spec.js', 'vitest.config.js', 'package.json', 'consumer.mts', 'consumer.cts', 'tsconfig.json']
    .map(path => ({ path, sha256: hash(join(fixture, path)) })),
  node: process.version, stages: [], passed: false
};
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
function npm(name, args, cwd = consumer) { return run(name, process.execPath, [npmCli, ...args], cwd); }
try {
  const packed = JSON.parse(npm('pack-helper', ['pack', './packages/test', '--ignore-scripts', '--json', '--pack-destination', output], root))[0];
  const helperArtifact = join(output, packed.filename);
  report.helper = { artifact: helperArtifact, sha256: hash(helperArtifact) };
  cpSync(fixture, consumer, { recursive: true, filter: path => !path.split('/').includes('node_modules') });
  for (let ancestor = dirname(realpathSync(consumer)); ; ancestor = dirname(ancestor)) {
    assert(!existsSync(join(ancestor, 'node_modules')), `Consumer ancestor contains node_modules: ${ancestor}`);
    if (dirname(ancestor) === ancestor) { break; }
  }
  const manifest = JSON.parse(readFileSync(join(consumer, 'package.json'), 'utf8'));
  manifest.dependencies['@mnjs/test'] = `file:${helperArtifact}`;
  manifest.dependencies['@mnjs/formkit'] = `file:${formkitArtifact}`;
  writeFileSync(join(consumer, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
  npm('install-lock', ['install', '--ignore-scripts', '--no-audit', '--no-fund']);
  cpSync(join(consumer, 'package-lock.json'), join(output, 'package-lock.json'));
  report.lockSha256 = hash(join(consumer, 'package-lock.json'));
  npm('locked-install', ['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
  assert.equal(hash(join(consumer, 'package-lock.json')), report.lockSha256);
  run('versions', process.execPath, ['-e', 'const a=require(\'node:assert/strict\');const version=n=>require(n+\'/package.json\').version;a.equal(version(\'marionette\'),\'5.0.0\');a.equal(version(\'@mnjs/test\'),\'0.1.0\');a.equal(version(\'@formkit/core\'),\'2.1.2\');console.log(JSON.stringify({marionette:version(\'marionette\'),helper:version(\'@mnjs/test\'),formkit:version(\'@mnjs/formkit\'),core:version(\'@formkit/core\')}));']);
  npm('formkit-types', ['run', 'test:types']);
  npm('formkit-dom', ['test']);
  if (values.browser) {
    report.browser = JSON.parse(run('browser-version', process.execPath, ['--input-type=module', '-e',
      'import { chromium } from \'playwright\'; const executable=process.env.MNJS_TEST_CHROMIUM_EXECUTABLE; const browser=await chromium.launch({executablePath:executable}); console.log(JSON.stringify({executable:executable??null,version:browser.version()})); await browser.close();']));
    npm('formkit-browser', ['run', 'test:browser']);
  }
  report.passed = true;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  rmSync(workspace, { recursive: true, force: true });
}
