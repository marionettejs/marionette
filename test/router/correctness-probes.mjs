import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { setImmediate as turn } from 'node:timers/promises';
import { Router, memoryDriver } from '@mnjs/router';

// Each process owns its rejection listener and GC roots. Exercise only public
// router/driver behavior; no pending-set reads or private instrumentation.
const modes = ['route-stop', 'route-unmount', 'route-navigate', 'driver-veto', 'retention',
  'memory-complete', 'memory-failed', 'memory-veto'];
const mode = process.argv[2];
if (!mode) {
  let failed = false;
  for (const name of modes) {
    const result = spawnSync(process.execPath, ['--expose-gc', import.meta.filename, name], { encoding: 'utf8' });
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    if (result.status !== 0) { failed = true; }
  }
  if (failed) { process.exitCode = 1; }
} else if (mode.startsWith('memory-')) {
  assert.ok(modes.includes(mode));
  assert.equal(typeof globalThis.gc, 'function', 'Run with --expose-gc');
  const driver = memoryDriver({ url: 'https://probe.test/outside' });
  const failure = new Error('handler failure');
  async function finish() {
    const payload = { marker: 'captured handler data' };
    const reference = new WeakRef(payload);
    const listeners = new AbortController();
    driver.addEventListener('navigate', event => {
      event.intercept({ handler() {
        assert.equal(payload.marker, 'captured handler data');
        if (mode === 'memory-failed') { throw failure; }
      } });
      if (mode === 'memory-veto') { event.preventDefault(); }
    }, { signal: listeners.signal });
    const result = driver.navigate('/page');
    const outcomes = await Promise.allSettled([result.committed, result.finished]);
    assert.equal(outcomes[1].status, mode === 'memory-complete' ? 'fulfilled' : 'rejected');
    listeners.abort();
    return reference;
  }
  const reference = await finish();
  for (let index = 0; index < 12; index++) { await turn(); globalThis.gc(); }
  const retained = reference.deref() !== undefined;
  console.log(JSON.stringify({ mode, retained, current: driver.currentEntry.url }));
  assert.equal(retained, false, 'A live memory driver must release its final settled handler data');
} else if (mode === 'retention') {
  assert.equal(typeof globalThis.gc, 'function', 'Run with --expose-gc');
  const driver = memoryDriver({ url: 'https://probe.test/outside' });
  const router = new Router({ driver, routes: [{ name: 'page', path: '/page' }] });
  await router.start();
  await router.getInitialDispatch();
  const listeners = new AbortController();
  driver.addEventListener('navigate', event => event.preventDefault(), { signal: listeners.signal });
  const references = [];
  async function veto(id) {
    const info = { id, payload: new Uint8Array(4096) };
    references.push(new WeakRef(info));
    assert.equal(await router.navigate('/page', { info }).finished, false);
  }
  for (let index = 0; index < 256; index++) { await veto(index); }
  listeners.abort();
  // Commit an ordinary route before stopping; final-driver-handler retention
  // has separate cases above. Keep the stopped router reachable during GC.
  assert.equal(await router.navigate('/page').finished, true);
  router.stop();
  for (let index = 0; index < 12; index++) { await turn(); globalThis.gc(); }
  const retained = references.filter(reference => reference.deref() !== undefined).length;
  console.log(JSON.stringify({ mode, attempts: references.length, retained, running: router.isRunning() }));
  router.destroy();
  assert.equal(retained, 0, 'Stopped router must release all driver-vetoed attempt info');
} else {
  assert.ok(modes.includes(mode));
  const unhandled = [];
  const listener = reason => unhandled.push(reason.message);
  process.on('unhandledRejection', listener);
  const pending = Promise.withResolvers();
  const driver = memoryDriver({ url: 'https://probe.test/outside' });
  const router = new Router({ driver, routes: [{ name: 'next', path: '/next' }] });
  const unmount = router.mount([{ name: 'source', path: '/source', redirect: () => pending.promise }]);
  await router.start();
  await router.getInitialDispatch();
  let next;
  if (mode === 'driver-veto') {
    driver.addEventListener('navigate', event => event.preventDefault());
  } else {
    router.once('route', () => {
      if (mode === 'route-stop') { router.stop(); }
      if (mode === 'route-unmount') { unmount(); }
      if (mode === 'route-navigate') { next = router.navigate('/next'); }
    });
  }
  assert.equal(await router.navigate('/source').finished, false);
  if (next) { assert.equal(await next.finished, true); }
  pending.reject(new Error(`${mode} abandoned redirect`));
  await turn();
  await turn();
  router.destroy();
  process.off('unhandledRejection', listener);
  console.log(JSON.stringify({ mode, unhandled }));
  assert.deepEqual(unhandled, [], 'Abandoned redirect rejection must be observed');
}
