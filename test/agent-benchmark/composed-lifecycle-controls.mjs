// Installed-consumer controls. Supply a prepared reference attempt and a new output directory.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { evaluateAttempt } from '../../scripts/agent-benchmark/harness.mjs';

const [sourceArgument, outputArgument] = process.argv.slice(2);
if (!sourceArgument || !outputArgument || process.argv.length !== 4) {
  throw new Error('Supply a prepared composed-lifecycle-repair reference attempt and a new output directory');
}
const source = resolve(sourceArgument);
const output = resolve(outputArgument);
const record = JSON.parse(await readFile(join(source, 'attempt.json'), 'utf8'));
assert.equal(record.taskId, 'composed-lifecycle-repair');
assert.equal(record.kind, 'reference-verification');
const original = await readFile(join(source, 'workspace/solution.mjs'), 'utf8');
function replaceOnce(text, from, to) {
  assert.equal(text.split(from).length, 2, `Control anchor must occur once: ${from}`);
  return text.replace(from, to);
}
const starter = await readFile(new URL('../../benchmarks/agent/tasks/composed-lifecycle-repair/workspace/solution.mjs', import.meta.url), 'utf8');
const variants = [
  { id: 'seeded-starter', change: () => starter,
    failed: ['late validation cannot overwrite a newer successful start',
      'refresh replacement, obsolete errors and successful stop invalidate pending work',
      'rejected stop preserves delivery, heartbeat, editing and pending refresh',
      'destroy adopts stop permission and prevents late refresh commits',
      'borrowed source survives destruction for another consumer'] },
  { id: 'correct-reference', change: text => text, failed: [] },
  { id: 'missing-load-guard', change: text => replaceOnce(text,
    '      if (controller.signal.aborted) { return false; }\n      await validate', '      await validate'),
  failed: ['canceled loading never validates or commits its late value'] },
  { id: 'missing-validation-guard', change: text => replaceOnce(text,
    '      await validate(value, { signal: controller.signal });\n      if (controller.signal.aborted) { return false; }',
    '      await validate(value, { signal: controller.signal });'),
  failed: ['late validation cannot overwrite a newer successful start',
    'refresh replacement, obsolete errors and successful stop invalidate pending work',
    'destroy adopts stop permission and prevents late refresh commits'] },
  { id: 'premature-disposal', change: text => replaceOnce(text, '    onStop: release,', '    onBeforeStop: release,'),
    failed: ['rejected stop preserves delivery, heartbeat, editing and pending refresh'] },
  { id: 'owned-shared-state', change: text => replaceOnce(text, '  const app = new Session({ state });',
    '  Session.prototype.createState = () => state;\n  const app = new Session();'),
  failed: ['borrowed source survives destruction for another consumer'] },
  { id: 'running-guard-drops-pending-stop-refresh', change: text => replaceOnce(text,
    'return active ? request(id)', 'return app.isRunning() ? request(id)'),
  failed: ['rejected stop preserves delivery, heartbeat, editing and pending refresh'] },
  { id: 'obsolete-errors-rethrown', change: text => replaceOnce(text,
    '    } catch (error) {\n      if (controller.signal.aborted) { return false; }',
    '    } catch (error) {'),
  failed: ['refresh replacement, obsolete errors and successful stop invalidate pending work',
    'refresh validation errors respect replacement and preserve data for retry'] },
  { id: 'timer-survives-stop', change: text => replaceOnce(text, '    releaseTimer?.();', ''),
    failed: ['working startup, edits, refresh errors and repeated resource cycles survive repair',
      'destroy adopts stop permission and prevents late refresh commits',
      'borrowed source survives destruction for another consumer'] }
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
  await writeFile(join(output, 'controls.json'), `${JSON.stringify({ scored: false, results }, null, 2)}\n`);
  assert.equal(result.failure, null);
  assert.equal(result.aborted, false);
  assert.match(result.stdout, /^# cancelled 0$/m);
  assert.doesNotMatch(result.stdout, /testTimeoutFailure|unhandledRejection|uncaughtException/);
  assert.equal(result.exitCode, variant.failed.length ? 1 : 0);
  assert.deepEqual([...result.expectedCases].filter(name => !result.observedCases.includes(name)).sort(),
    [...variant.failed].sort(), `${variant.id}: unexpected behavioral failures; see ${attempt}/result.json`);
  assert.equal(result.acceptancePassed, !variant.failed.length);
  console.log(`PASS ${variant.id}: ${variant.failed.length} expected behavioral failures`);
}
