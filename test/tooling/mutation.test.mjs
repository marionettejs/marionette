import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { resolvePolicy, runBudgeted, summarizeReport } from '../../scripts/testing/mutation.mjs';

test('CLI rejects ad hoc scope overrides before starting Stryker', () => {
  const script = fileURLToPath(new URL('../../scripts/testing/mutation.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script, '--mutate', '**/*'], { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage: node scripts\/testing\/mutation.mjs/);
  assert.equal(result.stdout, '');
});

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'marionette-mutation-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'config'));
  await writeFile(join(directory, 'sample.ts'), 'const owner = { show() { return true; } };\n');
  const policy = { schemaVersion: 1, concurrency: 2, budgetMs: 600000,
    targets: [{ file: 'sample.ts', methods: ['show'] }], testFiles: ['test/public.spec.js'] };
  async function save() { await writeFile(join(directory, 'config/mutation.json'), JSON.stringify(policy)); }
  await save();
  return { directory, policy, save };
}

test('method ranges track source movement and missing or ambiguous methods fail closed', async t => {
  const { directory } = await fixture(t);
  const first = await resolvePolicy(directory);
  assert.match(first.mutate[0], /^sample.ts:1:/);
  await writeFile(join(directory, 'sample.ts'), '\nconst owner = { show() { return true; } };\n');
  const moved = await resolvePolicy(directory);
  assert.match(moved.mutate[0], /^sample.ts:2:/);
  assert.notEqual(first.sources[0].sha256, moved.sources[0].sha256);
  await writeFile(join(directory, 'sample.ts'), 'const owner = { renamed() {} };\n');
  await assert.rejects(resolvePolicy(directory), /method show; found 0/);
  await writeFile(join(directory, 'sample.ts'), 'const owners = [{ show() {} }, { show() {} }];\n');
  await assert.rejects(resolvePolicy(directory), /method show; found 2/);
});

test('policy rejects unbounded workers, runtime and targets outside the checkout', async t => {
  const { directory, policy, save } = await fixture(t);
  policy.concurrency = 3;
  await save();
  await assert.rejects(resolvePolicy(directory), /concurrency 2/);
  policy.concurrency = 2;
  policy.budgetMs++;
  await save();
  await assert.rejects(resolvePolicy(directory), /600000ms/);
  policy.budgetMs = 600000;
  policy.targets[0].file = '../outside.ts';
  await save();
  await assert.rejects(resolvePolicy(directory), /inside the checkout/);
});

test('summary retains surviving, uncovered, timed out and invalid mutations separately', () => {
  const statuses = ['Killed', 'Killed', 'Survived', 'NoCoverage', 'Timeout', 'CompileError', 'RuntimeError', 'Pending'];
  const result = summarizeReport({ files: { 'sample.ts': { mutants: statuses.map((status, id) => ({ id, status })) } } });
  assert.equal(result.total, 8);
  assert.equal(result.mutationScore, 60);
  assert.equal(result.complete, false);
  assert.equal(result.counts.CompileError, 1);
  assert.equal(result.unresolved.length, 6);
  assert.throws(() => summarizeReport({}), /no files/);
  assert.throws(() => summarizeReport({ files: {} }), /no mutants/);
  assert.throws(() => summarizeReport({ files: {} }, ['sample.ts']), /selected source sample.ts/);
  assert.throws(() => summarizeReport({ files: { 'sample.ts': { mutants: [{ status: 'Unknown' }] } } }), /Unknown mutation status/);
});

test('deadline terminates workers and preserves partial output', async t => {
  const { directory } = await fixture(t);
  const worker = join(directory, 'worker.mjs');
  await writeFile(worker, `import { spawn } from 'node:child_process';
process.on('SIGTERM', () => {});
const child = spawn(process.execPath, ['-e', "process.on('SIGTERM', () => {});setInterval(() => {}, 1000)"], { stdio: 'inherit' });
console.log('worker=' + child.pid);
setInterval(() => {}, 1000);
`);
  const logFile = join(directory, 'run.log');
  const started = Date.now();
  const result = await runBudgeted(process.execPath, [worker], { cwd: directory, env: process.env, budgetMs: 10000, logFile });
  assert.equal(result.timedOut, true);
  assert.ok(Date.now() - started < 15000);
  const log = await readFile(logFile, 'utf8');
  assert.match(log, /worker=\d+/);
  if (process.platform !== 'win32') {
    const pid = Number(log.match(/worker=(\d+)/)[1]);
    const state = spawnSync('ps', ['-o', 'stat=', '-p', String(pid)], { encoding: 'utf8' }).stdout.trim();
    assert.ok(!state || state.startsWith('Z'), `worker ${pid} still running: ${state}`);
  }
});

test('successful process completion retains output and exit code', async t => {
  const { directory } = await fixture(t);
  const logFile = join(directory, 'run.log');
  const result = await runBudgeted(process.execPath, ['-e', 'console.log(\'complete\');process.exitCode = 2'], {
    cwd: directory, env: process.env, budgetMs: 30000, logFile
  });
  assert.deepEqual(result, { code: 2, signal: null, timedOut: false });
  assert.equal(await readFile(logFile, 'utf8'), 'complete\n');
});
