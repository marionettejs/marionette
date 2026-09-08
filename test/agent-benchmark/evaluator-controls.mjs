// Optional installed-consumer controls; ordinary test:tooling does not run installs.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { evaluateAttempt } from '../../scripts/agent-benchmark/harness.mjs';

const prepared = process.argv[2];
if (!prepared) { throw new Error('Supply a freshly prepared nested-workspace attempt directory'); }
const source = resolve(prepared);
async function control(change, check, options = {}) {
  const attempt = await mkdtemp(join(tmpdir(), 'marionette-evaluator-control-'));
  try {
    await cp(join(source, 'workspace'), join(attempt, 'workspace'), { recursive: true });
    const record = JSON.parse(await readFile(join(source, 'attempt.json'), 'utf8'));
    record.attemptId = randomUUID(); record.kind = 'evaluator-negative-control';
    await writeFile(join(attempt, 'attempt.json'), JSON.stringify(record));
    await change(attempt);
    const result = await evaluateAttempt({ attempt, ...options });
    assert.equal(result.acceptancePassed, false);
    assert.equal(result.fullyCorrect, false);
    await check(result, attempt);
  } finally { await rm(attempt, { recursive: true, force: true }); }
}

test('post-attempt hidden-target collision never overwrites the submission', async() => {
  await control(attempt => writeFile(join(attempt,'workspace/test/acceptance.test.mjs'),'agent work'), async(result,attempt) => {
    assert.match(result.failure,/EEXIST/);
    assert.equal(await readFile(join(attempt,'workspace/test/acceptance.test.mjs'),'utf8'),'agent work');
  });
});

test('post-attempt symlink cannot expose an external file to acceptance', async() => {
  await control(attempt => symlink(join(attempt,'attempt.json'),join(attempt,'workspace/alias')), result => assert.match(result.failure,/link or special file/));
});

test('dependency modification cannot change what package was tested', async() => {
  await control(attempt => writeFile(join(attempt,'workspace/package.json'),'{}'), result => assert.match(result.failure,/modified pinned dependencies/));
});

test('early process exit cannot masquerade as successful hidden acceptance', async() => {
  await control(attempt => writeFile(join(attempt,'workspace/solution.mjs'),'process.exit(0);'), result => {
    assert.equal(result.exitCode,0);
    assert.deepEqual(result.observedCases,['test/acceptance.test.mjs']);
  });
});

test('abort retains attempted denominator and deduplicated catalog findings', async() => {
  await control(async()=>{}, result => {
    assert.equal(result.attempted,true);assert.equal(result.aborted,true);
    assert.deepEqual(result.uniqueArchitectureViolations,['MN0015']);
  }, {aborted: true,violations: ['MN0015','MN0015']});
});

test('timeout is an aborted incorrect attempt and cannot be evaluated twice', async() => {
  await control(attempt => writeFile(join(attempt,'workspace/solution.mjs'),'export function createWorkspace() { for (;;) {} }'), async(result,attempt) => {
    assert.equal(result.aborted,true);
    await assert.rejects(evaluateAttempt({attempt}),/already evaluated/);
  }, {timeout: 1000});
});
