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
const consumer = resolve(process.argv[2] ?? '.');
const modes = ['complete', 'failed', 'veto'];
const mode = process.argv[3];
if (!mode) {
  let failed = false;
  for (const name of modes) {
    const result = spawnSync(process.execPath, ['--expose-gc', import.meta.filename, consumer, name], { encoding: 'utf8' });
    process.stdout.write(result.stdout); process.stderr.write(result.stderr);
    if (result.status !== 0) { failed = true; }
  }
  if (failed) { process.exitCode = 1; }
} else {
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
