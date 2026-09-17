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
assert.ok(['borrowed-workspace-state', 'async-session', 'filter-projects'].includes(record.taskId));
const original = await readFile(join(source, 'workspace/solution.mjs'), 'utf8');
const replaceOnce = (text, before, after) => {
  assert.equal(text.split(before).length, 2, `Expected one reference anchor for ${record.taskId}: ${JSON.stringify(before)}`);
  return text.replace(before, after);
};
const variants = {
  'borrowed-workspace-state': [
    { id: 'retained-view-reference', change: text => text, passes: true },
    { id: 'current-region-view', change: text => replaceOnce(text, '      return view;', '      return child.getView();'), passes: true },
    { id: 'disposes-borrowed-state', change: text => replaceOnce(text,
      '  const app = new Workspace({\n    state: sharedState\n  });',
      '  Workspace.prototype.createState = () => sharedState;\n  const app = new Workspace();'), passes: false, failure: /Borrowed state must not be disposed/ }
  ],
  'async-session': [
    { id: 'immediate-acquisition', change: text => text, passes: true },
    { id: 'microtask-acquisition', change: text => replaceOnce(text, 'await acquire()', 'await Promise.resolve().then(() => acquire())'), passes: true },
    { id: 'skips-stale-acquisition', change: text => replaceOnce(text,
      '      const provider = await acquire();',
      '      await Promise.resolve();\n      if (destroyed || token !== generation) { return false; }\n      const provider = await acquire();'), passes: true },
    { id: 'acquires-after-destroy', change: text => replaceOnce(text,
      '      if (destroyed) {\n        return false;\n      }',
      '      if (destroyed) {\n        (await acquire()).close();\n        return false;\n      }'), passes: true },
    { id: 'serialized-acquisition', change: text => `${replaceOnce(text, 'export function createSession(', 'function createBaseSession(')}
export function createSession(acquire, onMessage) {
  let previous = Promise.resolve();
  return createBaseSession(() => {
    const acquired = previous.then(acquire);
    previous = acquired.then(() => undefined);
    return acquired;
  }, onMessage);
}
`, passes: true },
    { id: 'awaits-pending-destruction', change: text => `${replaceOnce(text, 'export function createSession(', 'function createBaseSession(')}
export function createSession(...args) {
  const session = createBaseSession(...args);
  const pending = [];
  return {
    start() { const result = session.start(); pending.push(result); return result; },
    stop() { return session.stop(); },
    async destroy() { await session.destroy(); await Promise.all(pending); }
  };
}
`, passes: true },
    { id: 'leaks-stale-provider', change: text => replaceOnce(text, '        provider.close();', ''), passes: false, failure: /0 !== 1/ }
  ],
  'filter-projects': [
    { id: 'collection-filter', change: text => text, passes: true },
    { id: 'dom-hidden-filter', change: text => replaceOnce(text,
      '      view.setFilter(child => child.project.label.toLowerCase().includes(text));',
      '      view.children.toArray().forEach(child => { child.el.hidden = !child.project.label.toLowerCase().includes(text); });'), passes: true },
    { id: 'no-filter', change: text => replaceOnce(text,
      '      view.setFilter(child => child.project.label.toLowerCase().includes(text));',
      '      void text;'), passes: false, failure: /Expected values to be strictly deep-equal/ },
    { id: 'blank-labels', change: text => replaceOnce(text, '    child.el.textContent = project.label;', ''), passes: false, failure: /<Beta>/ }
  ]
}[record.taskId];
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
