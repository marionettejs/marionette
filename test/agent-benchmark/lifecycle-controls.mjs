// Installed-consumer controls; supply a freshly prepared reference.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { evaluateAttempt } from '../../scripts/agent-benchmark/harness.mjs';

const [prepared, destination] = process.argv.slice(2);
if (!prepared || !destination || process.argv.length !== 4) { throw new Error('Supply prepared reference and new output directory'); }
const source = resolve(prepared);
const output = resolve(destination);
const record = JSON.parse(await readFile(join(source, 'attempt.json'), 'utf8'));
assert.ok(['render-resource', 'attach-resource'].includes(record.taskId));
const original = await readFile(join(source, 'workspace/solution.mjs'), 'utf8');
const replaceOnce = (text, before, after) => {
  assert.equal(text.split(before).length, 2, `Expected one reference anchor for ${record.taskId}: ${JSON.stringify(before)}`);
  return text.replace(before, after);
};
const starter = await readFile(new URL(`../../benchmarks/agent/tasks/${record.taskId}/workspace/solution.mjs`, import.meta.url), 'utf8');
const variants = [
  { id: 'reference', change: text => text, passes: true },
  { id: 'event-listener', change: () => replaceOnce(starter,
    record.taskId === 'render-resource' ? 'this.once(\'render\', release)' : 'this.once(\'attach\', release)',
    record.taskId === 'render-resource' ? 'this.once(\'before:render\', release)' : 'this.once(\'before:detach\', release)'), passes: true },
  { id: 'missing-view-argument', change: text => record.taskId === 'render-resource' ?
    replaceOnce(text, 'makeResource(this)', 'makeResource()') :
    replaceOnce(text, 'connect(this)', 'connect()'), passes: false, failure: /ERR_ASSERTION/ },
  { id: 'premature-disposal', change: () => starter, passes: false, failure: /ERR_ASSERTION/ },
  { id: 'missing-final-cleanup', change: text => record.taskId === 'render-resource' ?
    replaceOnce(text, '    onBeforeDestroy: release', '') :
    replaceOnce(text, 'destroy() { region.destroy(); view.destroy(); }', 'destroy() {}'), passes: false, failure: /ERR_ASSERTION/ }
];
await mkdir(output);
const results = [];
for (const variant of variants) {
  const attempt = join(output, variant.id);
  await mkdir(attempt);
  await cp(join(source, 'workspace'), join(attempt, 'workspace'), { recursive: true });
  await writeFile(join(attempt, 'attempt.json'), JSON.stringify({ ...record,
    attemptId: randomUUID(), kind: 'known-behavior-control' }));
  await writeFile(join(attempt, 'workspace/solution.mjs'), variant.change(original));
  const result = await evaluateAttempt({ attempt });
  results.push({ id: variant.id, ...result });
  await writeFile(join(output, 'controls.json'), JSON.stringify({ complete: false, scored: false, results }, null, 2));
  assert.equal(result.failure, null);
  assert.equal(result.aborted, false);
  assert.match(result.stdout, /^# cancelled 0$/m);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /testTimeoutFailure|hookFailed|unhandledRejection|uncaughtException/);
  assert.equal(result.acceptancePassed, variant.passes);
  assert.equal(result.exitCode, variant.passes ? 0 : 1);
  if (!variant.passes) { assert.match(result.stdout, variant.failure); }
  console.log(`PASS ${variant.id}`);
}
await writeFile(join(output, 'controls.json'), `${JSON.stringify({ complete: true, scored: false, results }, null, 2)}\n`);
