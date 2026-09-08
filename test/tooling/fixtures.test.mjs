import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { copyCoverageFixture } from './coverage-fixture.mjs';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const npmCli = process.env.npm_execpath;
const names = ['marionette', '@marionette/data', '@marionette/adapters', '@marionette/utils', '@marionette/radio'];
let temporary;
let sequence = 0;

function json(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function pack(directory, name, extra = {}) {
  const source = resolve(directory, 'source');
  mkdirSync(resolve(source, 'package'), { recursive: true });
  json(resolve(source, 'package/package.json'), { name, version: '1.0.0', type: 'module', exports: './index.js', ...extra });
  writeFileSync(resolve(source, 'package/index.js'), 'export const candidate = true;\n');
  const path = resolve(directory, `${name.replace(/[@/]/g, '')}.tgz`);
  execFileSync('tar', ['-czf', path, '-C', source, 'package']);
  rmSync(source, { recursive: true });
  return path;
}

function scenario() {
  const root = resolve(temporary, `scenario-${sequence++}`);
  const fixture = resolve(root, 'test/fixtures/sample');
  mkdirSync(fixture, { recursive: true });
  mkdirSync(resolve(root, 'docs'));
  mkdirSync(resolve(root, 'artifacts'));
  mkdirSync(resolve(root, 'config'));
  json(resolve(root, 'config/release-validation.json'), { schemaVersion: 1, fixtures: ['sample', 'unselected'] });
  copyCoverageFixture(resolve(repository, 'test/fixtures/run.mjs'), resolve(root, 'test/fixtures/run.mjs'));
  cpSync(resolve(temporary, 'package-lock.json'), resolve(fixture, 'package-lock.json'));
  cpSync(resolve(temporary, 'package.json'), resolve(fixture, 'package.json'));
  for (const name of names) {
    cpSync(resolve(temporary, `${name.replace(/[@/]/g, '')}.tgz`), resolve(root, 'artifacts', `${name.replace(/[@/]/g, '')}.tgz`));
  }
  const cwdLog = resolve(root, 'cwd.txt');
  writeFileSync(resolve(fixture, 'validate.mjs'), `
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { appendFileSync } from 'node:fs';
import { candidate } from 'marionette';
assert.equal(candidate, true);
assert.throws(() => createRequire(import.meta.url).resolve('fixture-ancestor-only'), { code: 'MODULE_NOT_FOUND' });
appendFileSync(${JSON.stringify(cwdLog)}, process.cwd() + '\\n');
`);
  const ancestorPackage = resolve(root, 'node_modules/fixture-ancestor-only');
  mkdirSync(ancestorPackage, { recursive: true });
  json(resolve(ancestorPackage, 'package.json'), { name: 'fixture-ancestor-only', main: 'index.js' });
  writeFileSync(resolve(ancestorPackage, 'index.js'), 'module.exports = true;');
  const second = resolve(root, 'test/fixtures/unselected');
  cpSync(fixture, second, { recursive: true });
  writeFileSync(resolve(second, 'validate.mjs'), 'throw new Error(\'Unselected fixture executed\');\n');
  json(resolve(root, 'artifacts/release-evidence.json'), evidence(root));
  return { root, fixture, cwdLog };
}

function command(root, args = [], env = {}) {
  return {
    args: [resolve(root, 'test/fixtures/run.mjs'), '--fixture', 'sample', '--artifact-dir', resolve(root, 'artifacts'), '--report', resolve(root, 'report.json'), ...args],
    options: { cwd: root, encoding: 'utf8', env: {
      ...process.env, 'npm_execpath': npmCli, NODE_PATH: resolve(root, 'node_modules'),
      PATH: `${resolve(root, 'node_modules/.bin')}${delimiter}${process.env.PATH}`, ...env,
    } },
  };
}

function run(root, args, env) {
  const invocation = command(root, args, env);
  return spawnSync(process.execPath, invocation.args, invocation.options);
}

function report(root) {
  return JSON.parse(readFileSync(resolve(root, 'report.json'), 'utf8'));
}

function evidence(root) {
  const packages = names.map(name => {
    const file = `${name.replace(/[@/]/g, '')}.tgz`;
    const path = resolve(root, 'artifacts', file);
    const bytes = readFileSync(path);
    return {
      name, version: '1.0.0',
      manifest: JSON.parse(execFileSync('tar', ['-xOf', path, 'package/package.json'], { encoding: 'utf8' })),
      tarball: {
        file, size: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        sha512: createHash('sha512').update(bytes).digest('hex'),
        integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
      },
    };
  });
  return { packages, source: { commit: 'fixture-source' } };
}

before(() => {
  assert.ok(npmCli, 'Run tooling tests through npm (npm exec -- node --test test/tooling/fixtures.test.mjs)');
  temporary = mkdtempSync(resolve(tmpdir(), 'marionette-fixture-runner-tests-'));
  json(resolve(temporary, 'package.json'), { name: 'fixture-runner-test', private: true, type: 'module', scripts: { validate: 'node validate.mjs' } });
  execFileSync(process.execPath, [npmCli, 'install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: temporary });
  for (const name of names) {
    pack(temporary, name);
  }
});
after(() => {
  if (temporary) {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test('rejects partial artifact arguments and unknown fixtures before attempting a build', () => {
  const { root } = scenario();
  const script = resolve(root, 'test/fixtures/run.mjs');
  for (const args of [['--tarball', 'one.tgz'], ['--fixture', 'missing']]) {
    const result = spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Supply all five|Unknown fixture/);
    assert.doesNotMatch(result.stdout, /Building/);
  }
});

test('rejects missing candidates and corrupt evidence before npm is invoked', () => {
  for (const corrupt of [false, true]) {
    const { root } = scenario();
    if (corrupt) {
      const data = evidence(root);
      data.packages[0].tarball.sha256 = 'bad';
      json(resolve(root, 'artifacts/release-evidence.json'), data);
    } else {
      rmSync(resolve(root, 'artifacts/marionetteutils.tgz'));
    }
    const sentinel = resolve(root, 'npm-called');
    const fakeNpm = resolve(root, 'npm.mjs');
    writeFileSync(fakeNpm, `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(sentinel)}, 'called'); process.exit(1);`);
    const result = run(root, [], { 'npm_execpath': fakeNpm });
    assert.equal(result.status, 1);
    assert.equal(existsSync(sentinel), false);
    assert.equal(report(root).stage, 'artifacts');
    assert.match(result.stderr, /Expected all five|Release evidence does not match/);
  }
});

test('runs selected fixture against exact artifacts, never ancestor dependencies, and leaves checkout untouched', () => {
  const { root, fixture, cwdLog } = scenario();
  json(resolve(root, 'artifacts/release-evidence.json'), evidence(root));
  const originalLock = readFileSync(resolve(fixture, 'package-lock.json'), 'utf8');
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  const summary = report(root);
  assert.equal(summary.status, 'passed');
  assert.equal(summary.fixtures.length, 1);
  assert.equal(summary.fixtures[0].name, 'sample');
  assert.deepEqual(summary.fixtures[0].graph, {});
  assert.equal(summary.artifacts.length, 5);
  assert.equal(summary.evidence.source.commit, 'fixture-source');
  assert.ok(summary.artifacts.every(artifact => /^[a-f0-9]{64}$/.test(artifact.sha256)));
  const isolated = readFileSync(cwdLog, 'utf8').trim();
  assert.ok(!isolated.startsWith(root));
  assert.equal(existsSync(isolated), false);
  assert.equal(readFileSync(resolve(fixture, 'package-lock.json'), 'utf8'), originalLock);
  assert.equal(existsSync(resolve(fixture, 'node_modules')), false);
});

test('accepts a complete explicit tarball set without rebuilding', () => {
  const { root } = scenario();
  const invocation = command(root);
  const artifactIndex = invocation.args.indexOf('--artifact-dir');
  invocation.args.splice(artifactIndex, 2);
  const flags = ['--tarball', '--data-tarball', '--adapters-tarball', '--utils-tarball', '--radio-tarball'];
  flags.forEach((flag, index) => invocation.args.push(flag, resolve(root, 'artifacts', `${names[index].replace(/[@/]/g, '')}.tgz`)));
  const result = spawnSync(process.execPath, invocation.args, invocation.options);
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /Building/);
  assert.equal(report(root).status, 'passed');
});

test('rejects candidate dependency graph drift rather than quietly resolving new dependencies', () => {
  const { root } = scenario();
  const extra = pack(root, 'fixture-extra');
  pack(resolve(root, 'artifacts'), 'marionette', { dependencies: { 'fixture-extra': `file:${extra}` } });
  json(resolve(root, 'artifacts/release-evidence.json'), evidence(root));
  const result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /changed the committed external dependency graph/);
  assert.equal(report(root).fixtures[0].stage, 'candidate-lock');
});

test('reports validation failures with fixture, stage and process output', () => {
  const { root, fixture } = scenario();
  writeFileSync(resolve(fixture, 'validate.mjs'), 'throw new Error(\'fixture-validation-sentinel\');\n');
  const result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Fixture sample failed at validate/);
  assert.match(result.stderr, /fixture-validation-sentinel/);
  assert.equal(report(root).fixtures[0].status, 'failed');
  assert.equal(report(root).fixtures[0].stage, 'validate');
});

test('a failed fixture does not hide outcomes from the rest of the matrix', () => {
  const { root, fixture } = scenario();
  writeFileSync(resolve(fixture, 'validate.mjs'), 'throw new Error(\'first-fixture-failed\');\n');
  writeFileSync(resolve(root, 'test/fixtures/unselected/validate.mjs'), 'console.log(\'second-fixture-ran\');\n');
  const invocation = command(root);
  invocation.args.splice(invocation.args.indexOf('--fixture'), 2);
  const result = spawnSync(process.execPath, invocation.args, invocation.options);
  assert.equal(result.status, 1);
  const summary = report(root);
  assert.equal(summary.status, 'failed');
  assert.deepEqual(summary.fixtures.map(entry => [entry.name, entry.status]), [['sample', 'failed'], ['unselected', 'passed']]);
  assert.match(summary.fixtures[1].output, /second-fixture-ran/);
});

test('strict script approvals block unapproved candidate lifecycle scripts', () => {
  const { root } = scenario();
  const sentinel = resolve(root, 'unapproved-script');
  pack(resolve(root, 'artifacts'), 'marionette', {
    scripts: { install: `node -e "require('node:fs').writeFileSync('${sentinel.replace(/\\/g, '/')}', 'executed')"` },
  });
  json(resolve(root, 'artifacts/release-evidence.json'), evidence(root));
  const result = run(root);
  assert.equal(result.status, 1, result.stdout);
  assert.equal(existsSync(sentinel), false);
  assert.equal(report(root).fixtures[0].stage, 'install');
  assert.match(result.stderr, /allowScripts|allow-scripts/i);
});

test('concurrent runs use independent workspaces and cleanup', async() => {
  const { root, cwdLog } = scenario();
  function launch(index) {
    const invocation = command(root);
    invocation.args[invocation.args.indexOf('--report') + 1] = resolve(root, `report-${index}.json`);
    return new Promise((resolvePromise, reject) => {
      const child = spawn(process.execPath, invocation.args, invocation.options);
      let output = '';
      child.stdout.on('data', chunk => { output += chunk; });
      child.stderr.on('data', chunk => { output += chunk; });
      child.on('error', reject);
      child.on('close', code => resolvePromise({ code, output }));
    });
  }
  const results = await Promise.all([launch(1), launch(2)]);
  for (const result of results) {
    assert.equal(result.code, 0, result.output);
  }
  const directories = readFileSync(cwdLog, 'utf8').trim().split('\n');
  assert.equal(directories.length, 2);
  assert.notEqual(directories[0], directories[1]);
  assert.ok(directories.every(directory => !existsSync(directory)));
});

test('artifact-directory mode rejects missing release evidence before invoking npm', () => {
  const { root } = scenario();
  rmSync(resolve(root, 'artifacts/release-evidence.json'));
  const result = run(root);
  assert.equal(result.status, 1);
  assert.equal(report(root).stage, 'artifacts');
  assert.match(result.stderr, /Artifact-directory mode requires release-evidence.json/);
  assert.equal(report(root).fixtures.length, 0);
});

test('removing a fixture cannot silently shrink the release matrix', () => {
  const { root } = scenario();
  rmSync(resolve(root, 'test/fixtures/unselected'), { recursive: true });
  const result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /directories do not match the release validation inventory/);
  assert.doesNotMatch(result.stdout, /PASS/);
});
