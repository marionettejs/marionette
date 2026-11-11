import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { setImmediate as turn } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

// Run against the public entry of the supplied installed consumer. Keep a second
// subscriber attached so removing the capturing listener cannot hide retention
// by tearing down the Driver itself.
const modes = ['complete', 'failed', 'veto'];
// Certification calls this directly: only the bounded per-mode children exist,
// so an outer launcher deadline cannot leave a nested probe running.
export function verifyHistoryRetention(consumer, launch = spawnSync) {
  const failures = [];
  for (const name of modes) {
    const result = launch(process.execPath, ['--expose-gc', import.meta.filename, resolve(consumer), name], {
      encoding: 'utf8', timeout: 30000, killSignal: 'SIGKILL',
    });
    if (result.error) {
      failures.push(new Error(`History retention ${name}: ${result.error.message}`, { cause: result.error }));
    } else if (result.status !== 0) {
      failures.push(new Error(`History retention ${name}: exit ${result.status}, signal ${result.signal}`));
    }
    if (result.stdout) { process.stdout.write(result.stdout); }
    if (result.stderr) { process.stderr.write(result.stderr); }
  }
  if (failures.length) { throw new AggregateError(failures, 'Installed History driver retention probes failed'); }
}

async function probe(consumer, mode) {
  assert.ok(modes.includes(mode));
  assert.equal(typeof globalThis.gc, 'function', 'Run with --expose-gc');
  const require = createRequire(resolve(consumer, 'package.json'));
  const manifest = require('@mnjs/router/package.json');
  const { historyDriver } = await import(pathToFileURL(resolve(consumer, 'node_modules/@mnjs/router', manifest.exports['.'].import.default)));
  const dom = new JSDOM('', { url: 'https://history-retention.example/' });
  const driver = historyDriver({ window: dom.window });
  const keepAttached = new AbortController();
  driver.addEventListener('navigate', () => {}, { signal: keepAttached.signal });
  const failure = new Error('handler failure');
  async function finish() {
    const payload = { marker: 'captured handler data' };
    const reference = new WeakRef(payload);
    const listener = new AbortController();
    driver.addEventListener('navigate', event => {
      event.intercept({ handler() {
        assert.equal(payload.marker, 'captured handler data');
        if (mode === 'failed') { throw failure; }
      } });
      if (mode === 'veto') { event.preventDefault(); }
    }, { signal: listener.signal });
    const result = driver.navigate('/page');
    const outcomes = await Promise.allSettled([result.committed, result.finished]);
    assert.equal(outcomes[1].status, mode === 'complete' ? 'fulfilled' : 'rejected');
    listener.abort();
    return reference;
  }
  try {
    const reference = await finish();
    for (let index = 0; index < 12; index++) { await turn(); globalThis.gc(); }
    const retained = reference.deref() !== undefined;
    console.log(JSON.stringify({ mode: `history-${mode}`, retained, current: driver.currentEntry.url }));
    assert.equal(retained, false, 'An attached History driver must release its settled handler data');
  } finally { keepAttached.abort(); dom.window.close(); }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const consumer = resolve(process.argv[2] ?? '.');
  const mode = process.argv[3];
  if (mode) { await probe(consumer, mode); } else { verifyHistoryRetention(consumer); }
}
