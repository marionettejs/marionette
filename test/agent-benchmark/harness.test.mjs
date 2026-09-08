import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, link, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { evaluateOutcome, inventory, loadCorpus } from '../../scripts/agent-benchmark/harness.mjs';

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
    const packages = [['utils','@marionette/utils'],['radio','@marionette/radio'],['core','marionette'],['data','@marionette/data'],['adapters','@marionette/adapters']].map(([id,name]) => ({id,name,version: '5.0.0',tarball: {file: `${id}.tgz`,size: 1,sha512: 'wrong',integrity: 'wrong'}}));
    const manifestPath = join(root, 'evidence.json'); await writeFile(manifestPath, JSON.stringify({schemaVersion: 2,packages}));
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
