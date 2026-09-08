import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, link, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, posix, win32 } from 'node:path';
import { test } from 'node:test';
import { evaluateAttempt, evaluateOutcome, inventory, isWithin, loadCorpus } from '../../scripts/agent-benchmark/harness.mjs';

test('prototype corpus covers every capability twice and proposes ten paired tasks', async() => {
  const corpus = await loadCorpus();
  assert.equal(corpus.tasks.length, 13);
  assert.equal(corpus.status, 'prototype-unscored');
});

test('aborted attempts remain incorrect despite successful partial acceptance', () => {
  const result = evaluateOutcome({ aborted: true, exitCode: 0, tests: 3, passed: 3, failed: 0, violations: ['MN0015', 'MN0015', 'MN0002'] });
  assert.equal(result.attempted, true);
  assert.equal(result.acceptancePassed, false);
  assert.deepEqual(result.uniqueArchitectureViolations, ['MN0002', 'MN0015']);
});

test('zero-test exits, failures, and signaled processes cannot pass acceptance', () => {
  for (const input of [{ tests: 0, passed: 0 }, { tests: 3, passed: 2 }, { exitCode: 1 }, { signal: 'SIGTERM' }]) {
    assert.equal(evaluateOutcome({ aborted: false, exitCode: 0, tests: 3, passed: 3, failed: 0, violations: [], ...input }).acceptancePassed, false);
  }
});

test('inventory rejects symlink and hard-link exposure and hashes ordinary files', async() => {
  const directory = await mkdtemp(join(tmpdir(), 'agent-inventory-'));
  try {
    const workspace = join(directory, 'workspace'); await mkdir(workspace);
    const external = join(directory, 'secret'); await writeFile(external, 'withheld');
    const alias = join(workspace, 'alias'); await symlink(external, alias);
    await assert.rejects(inventory(workspace), /link or special file/);
    await rm(alias); await link(external, alias);
    await assert.rejects(inventory(workspace), /hard link/);
    await rm(alias); await writeFile(alias, 'visible');
    const first = await inventory(workspace); await writeFile(alias, 'changed');
    assert.notEqual((await inventory(workspace)).alias, first.alias);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('hidden injection preserves occupied targets and rejects escaping targets', async() => {
  const { installAcceptance } = await import('../../scripts/agent-benchmark/harness.mjs');
  const { readFile } = await import('node:fs/promises');
  const root = await mkdtemp(join(tmpdir(), 'agent-injection-'));
  try {
    const workspace = join(root, 'workspace'); await mkdir(workspace); await mkdir(join(workspace, 'test'));
    await writeFile(join(root, 'hidden.mjs'), 'hidden acceptance');
    const target = join(workspace, 'test/acceptance.mjs'); await writeFile(target, 'agent work');
    const task = { acceptance: { hiddenTests: [{ sourcePath: 'hidden.mjs', targetPath: 'test/acceptance.mjs' }] } };
    await assert.rejects(installAcceptance({ root, task, workspace }), { code: 'EEXIST' });
    assert.equal(await readFile(target, 'utf8'), 'agent work');
    await rm(target); await installAcceptance({ root, task, workspace });
    assert.equal(await readFile(target, 'utf8'), 'hidden acceptance');
    task.acceptance.hiddenTests[0].targetPath = '../escape.mjs';
    await assert.rejects(installAcceptance({ root, task, workspace }), /escapes workspace/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('artifact validation rejects changed tarball bytes before installation', async() => {
  const { prepareArtifacts } = await import('../../scripts/agent-benchmark/harness.mjs');
  const root = await mkdtemp(join(tmpdir(), 'agent-artifact-'));
  try {
    await writeFile(join(root, 'utils.tgz'), 'changed bytes');
    const packages = [['utils','@mnjs/utils'],['radio','@mnjs/radio'],['core','marionette'],['data','@mnjs/data'],['adapters','@mnjs/adapters']].map(([id,name]) => ({id,name,version: '5.0.0',tarball: {file: `${id}.tgz`,size: 1,sha512: 'wrong',integrity: 'wrong'}}));
    const manifestPath = join(root, 'evidence.json'); await writeFile(manifestPath, JSON.stringify({schemaVersion: 3,packages}));
    await assert.rejects(prepareArtifacts({manifestPath,output: join(root,'output')}), /integrity mismatch/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('CLI rejects malformed or contradictory options before preparing an attempt', async() => {
  const { spawnSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const cli = fileURLToPath(new URL('../../scripts/agent-benchmark/run.mjs', import.meta.url));
  for (const args of [['prepare'], ['reference','--unknown'], ['reference','--task'], ['reference','--aborted'], ['evaluate','--attempt','one','--attempt','two']]) {
    const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stdout, /PASS|Control report/);
  }
});

test('acceptance requires the actual expected cases, not a passing whole-file wrapper', () => {
  const result = { aborted: false, exitCode: 0, tests: 1, passed: 1, failed: 0, violations: [], expectedCases: ['owned child cleanup'] };
  assert.equal(evaluateOutcome({ ...result, observedCases: ['test/acceptance.test.mjs'] }).acceptancePassed, false);
  assert.equal(evaluateOutcome({ ...result, observedCases: ['owned child cleanup'] }).acceptancePassed, true);
});

test('containment rejects parent, sibling, and cross-volume targets with POSIX and Windows paths', () => {
  for (const [paths, parent, otherVolume] of [[posix, '/attempt/workspace', '/different/test.mjs'], [win32, 'C:\\attempt\\workspace', 'D:\\test.mjs']]) {
    assert.equal(isWithin(parent, paths.join(parent, 'test', 'acceptance.mjs'), paths), true);
    assert.equal(isWithin(parent, paths.join(parent, '..visible', 'acceptance.mjs'), paths), true);
    assert.equal(isWithin(parent, parent, paths), true);
    assert.equal(isWithin(parent, paths.dirname(parent), paths), false);
    assert.equal(isWithin(parent, paths.resolve(parent, '../escaped.mjs'), paths), false);
    assert.equal(isWithin(parent, `${parent}-sibling/acceptance.mjs`, paths), false);
    assert.equal(isWithin(parent, otherVolume, paths), false);
  }
  assert.equal(isWithin('\\\\server\\share\\workspace', '\\\\server\\other\\acceptance.mjs', win32), false);
});

test('evaluation records its actual runtime and rejects a differently prepared Node version before acceptance', async() => {
  const attempt = await mkdtemp(join(tmpdir(), 'agent-runtime-'));
  try {
    const runtime = { node: 'v0.0.0', npm: 'fixture', jsdom: '30.0.1' };
    await writeFile(join(attempt, 'attempt.json'), JSON.stringify({
      schemaVersion: 1, attemptId: 'runtime-mismatch', kind: 'local-unscored-attempt',
      taskId: 'nested-workspace', runtime, sealed: {}, packages: []
    }));
    const result = await evaluateAttempt({ attempt });
    assert.equal(result.acceptancePassed, false);
    assert.equal(result.fullyCorrect, false);
    assert.equal(result.scored, false);
    assert.match(result.failure, /Evaluator Node version changed since preparation: expected v0\.0\.0; actual v/);
    assert.equal(result.exitCode, null);
    assert.equal(result.stdout, '');
    assert.deepEqual(result.observedCases, []);
    assert.deepEqual(result.runtime, runtime);
    assert.deepEqual(result.evaluationRuntime, {
      node: process.version, executable: process.execPath, platform: process.platform, arch: process.arch
    });
    const { readFile } = await import('node:fs/promises');
    assert.deepEqual(JSON.parse(await readFile(join(attempt, 'result.json'), 'utf8')), result);
  } finally { await rm(attempt, { recursive: true, force: true }); }
});

test('preparation consumes locked tarballs from an isolated cache without registry metadata', async() => {
  const { spawnSync } = await import('node:child_process');
  const { createHash } = await import('node:crypto');
  const { cp, readFile } = await import('node:fs/promises');
  const { repositoryRoot } = await import('../../scripts/agent-benchmark/harness.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'agent-offline-cache-'));
  const env = { ...process.env, 'npm_config_cache': join(directory, 'cache'), 'npm_config_offline': 'true',
    'npm_config_registry': 'http://127.0.0.1:9', 'npm_config_update_notifier': 'false' };
  const execute = (command, args, cwd = directory) => {
    const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', timeout: 30000 });
    assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
    return result.stdout;
  };
  try {
    const root = join(directory, 'root');
    for (const path of ['benchmarks/agent', 'config/diagnostics', 'scripts/agent-benchmark']) {
      await cp(join(repositoryRoot, path), join(root, path), { recursive: true });
    }
    const packages = [];
    for (const [name, version] of [['jsdom', '30.0.1'], ['agent-cache-fixture', '1.0.0']]) {
      const source = join(directory, name); await mkdir(source);
      await writeFile(join(source, 'package.json'), JSON.stringify({ name, version }));
      const [packed] = JSON.parse(execute('npm', ['pack', '--ignore-scripts', '--offline', '--json', '--pack-destination', directory], source));
      packages.push({ name, version, path: join(directory, packed.filename), tarball: { integrity: packed.integrity } });
    }
    const [jsdom, local] = packages;
    execute('npm', ['cache', 'add', jsdom.path, '--offline']);
    // Synthetic locked package bytes isolate cache behavior from any shared npm cache.
    // The resolved registry URL deliberately has no cached packument or HTTP response.
    await writeFile(join(root, 'benchmarks/agent/support/dependency-lock.json'), JSON.stringify({
      name: 'agent-cache-environment', version: '0.0.0', lockfileVersion: 3, requires: true,
      packages: {
        '': { name: 'agent-cache-environment', version: '0.0.0', dependencies: { jsdom: jsdom.version } },
        'node_modules/jsdom': { version: jsdom.version, resolved: `http://127.0.0.1:9/jsdom/-/jsdom-${jsdom.version}.tgz`, integrity: jsdom.tarball.integrity }
      }
    }));
    local.tarball.sha512 = createHash('sha512').update(await readFile(local.path)).digest('hex');
    const attempt = join(directory, 'attempt');
    const script = `const { prepareAttempt } = await import(${JSON.stringify(new URL('../../scripts/agent-benchmark/harness.mjs', import.meta.url).href)}); await prepareAttempt(JSON.parse(process.argv[1]));`;
    execute(process.execPath, ['--input-type=module', '-e', script, JSON.stringify({ root, taskId: 'nested-workspace', artifacts: { packages: [local] }, output: attempt })]);
    const installed = JSON.parse(await readFile(join(attempt, 'workspace/package-lock.json'), 'utf8'));
    assert.equal(installed.packages['node_modules/jsdom'].integrity, jsdom.tarball.integrity);
    assert.equal(installed.packages['node_modules/agent-cache-fixture'].integrity, local.tarball.integrity);
    assert.equal(JSON.parse(await readFile(join(attempt, 'workspace/node_modules/jsdom/package.json'), 'utf8')).version, jsdom.version);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('corpus decisions reject an extra duplicate task', async() => {
  const { cp, readFile } = await import('node:fs/promises');
  const { repositoryRoot } = await import('../../scripts/agent-benchmark/harness.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'agent-decisions-'));
  try {
    await cp(join(repositoryRoot, 'benchmarks/agent'), join(directory, 'benchmarks/agent'), { recursive: true });
    const path = join(directory, 'benchmarks/agent/series-decisions.json');
    const decisions = JSON.parse(await readFile(path, 'utf8'));
    decisions.tasks.push(decisions.tasks[0]);
    await writeFile(path, JSON.stringify(decisions));
    await assert.rejects(loadCorpus(directory), /every task exactly once/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('CLI creates missing output parents while preserving exclusive attempt directories', async() => {
  const { spawnSync } = await import('node:child_process');
  const { stat } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const directory = await mkdtemp(join(tmpdir(), 'agent-output-'));
  try {
    const output = join(directory, 'missing/parent/attempt');
    const cli = fileURLToPath(new URL('../../scripts/agent-benchmark/run.mjs', import.meta.url));
    const args = [cli, 'prepare', '--task', 'unknown-task', '--output', output];
    const first = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.notEqual(first.status, 0);
    assert.match(first.stderr, /Unknown task: unknown-task/);
    assert.equal((await stat(output)).isDirectory(), true);
    const repeated = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.notEqual(repeated.status, 0);
    assert.match(repeated.stderr, /EEXIST/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});


test('saved artifact inputs can be reused for another benchmark attempt', async t => {
  const { fixture } = await import('../release/fixture.mjs');
  const { prepareArtifacts } = await import('../../scripts/agent-benchmark/harness.mjs');
  const candidate = await fixture(t);
  const first = await prepareArtifacts({ manifestPath: join(candidate.artifacts, 'release-evidence.json'),
    output: join(candidate.directory, 'first') });
  const second = await prepareArtifacts({ manifestPath: join(candidate.directory, 'first/artifact-input.json'),
    output: join(candidate.directory, 'second') });
  assert.deepEqual(second.packages.map(({ path, ...entry }) => entry), first.packages.map(({ path, ...entry }) => entry));
  assert.deepEqual(second.source, first.source);
});
