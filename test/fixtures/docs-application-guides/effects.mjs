import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { Model } from '@mnjs/data';
import { Radio } from '@mnjs/radio';

const markdown = await readFile(new URL('../../../docs/application-effects.md', import.meta.url), 'utf8');
const code = markdown.match(/<!-- executable-example: application-active-effects -->\n```javascript\n([\s\S]*?)\n```/);
assert.ok(code);
const example = new URL('./dist/effects.mjs', import.meta.url);
await writeFile(example, code[1]);
const { createEffects, createStatusFeature } = await import(example);

await test('documented Application effect ownership', async t => {
  const dom = new JSDOM('<!doctype html><main></main>');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  t.after(() => {
    dom.window.close();
    delete globalThis.window;
    delete globalThis.document;
  });
  let channelNumber = 0;
  function fixture(overrides = {}) {
    const state = new Model();
    const channel = Radio.channel(`documented-effects-${channelNumber++}`);
    const app = createStatusFeature({
      el: document.querySelector('main'), state, channel,
      load: async() => ({ label: 'Queue' }), ...overrides
    });
    return { app, state, channel, async dispose() {
      await app.destroy();
      state.destroy();
      channel.reset();
    } };
  }

  await t.test('reads the latest loading-time state and keeps run effects after readiness', async() => {
    const loading = Promise.withResolvers();
    let signal;
    const f = fixture({ load(options) { signal = options.signal; return loading.promise; } });
    try {
      const start = f.app.start();
      assert.equal(f.channel.request('current:filter'), 'open');
      f.state.set('filter', 'closed');
      assert.equal(f.channel.request('current:filter'), 'closed');
      assert.equal(document.querySelector('main').textContent, '');
      loading.resolve({ label: 'Queue' });
      assert.equal(await start, true);
      assert.equal(document.querySelector('main').textContent, 'Queue: closed');
      assert.equal(signal.aborted, false);
      f.state.set('filter', 'open');
      assert.equal(document.querySelector('main').textContent, 'Queue: open');
      await f.app.stop();
      assert.equal(signal.aborted, true);
      assert.equal(f.channel.request('current:filter'), undefined);
      f.state.set('filter', 'closed');
      assert.equal(f.app.isRunning(), false);
      assert.equal(f.app.getState(), f.state);
    } finally { await f.dispose(); }
  });

  await t.test('keeps effects and current state through rejected stop permission', async() => {
    const gate = Promise.withResolvers();
    let rejectStop = true;
    let signal;
    const f = fixture({
      load(options) { signal = options.signal; return Promise.resolve({ label: 'Queue' }); },
      beforeStop() { if (rejectStop) { return gate.promise; } }
    });
    try {
      await f.app.start();
      const stopping = f.app.stop();
      f.state.set('filter', 'closed');
      assert.equal(document.querySelector('main').textContent, 'Queue: closed');
      assert.equal(f.channel.request('current:filter'), 'closed');
      const failure = new Error('Keep editing');
      gate.reject(failure);
      await assert.rejects(stopping, error => error === failure);
      assert.equal(f.app.isRunning(), true);
      assert.equal(signal.aborted, false);
      assert.equal(document.querySelector('main').textContent, 'Queue: closed');
      rejectStop = false;
      await f.app.stop();
      assert.equal(signal.aborted, true);
    } finally { rejectStop = false; await f.dispose(); }
  });

  await t.test('cancels a loading scope and ignores a late result after a new start', async() => {
    const requests = [];
    const f = fixture({ load({ signal }) {
      const request = { signal, ...Promise.withResolvers() };
      requests.push(request);
      return request.promise;
    } });
    try {
      const oldStart = f.app.start();
      await f.app.stop();
      assert.equal(await oldStart, false);
      assert.equal(requests[0].signal.aborted, true);
      const start = f.app.start();
      requests[1].resolve({ label: 'Current' });
      await start;
      requests[0].resolve({ label: 'Stale' });
      await requests[0].promise;
      await Promise.resolve();
      assert.equal(document.querySelector('main').textContent, 'Current: open');
      assert.equal(requests[1].signal.aborted, false);
    } finally { requests.forEach(request => request.resolve({ label: 'Done' })); await f.dispose(); }
  });

  await t.test('releases failed readiness effects and retries with the same source', async() => {
    const failure = new Error('Unavailable');
    let attempt = 0;
    const signals = [];
    const f = fixture({ load({ signal }) {
      signals.push(signal);
      return attempt++ ? Promise.resolve({ label: 'Recovered' }) : Promise.reject(failure);
    } });
    try {
      await assert.rejects(f.app.start(), error => error === failure);
      assert.equal(signals[0].aborted, true);
      assert.equal(f.channel.request('current:filter'), undefined);
      f.state.set('filter', 'closed');
      await f.app.start();
      assert.equal(f.app.getState(), f.state);
      assert.equal(document.querySelector('main').textContent, 'Recovered: closed');
    } finally { await f.dispose(); }
  });

  await t.test('does not accumulate callbacks across restarts or remove independent observers', async() => {
    const f = fixture();
    let independent = 0;
    const observer = () => { independent++; };
    f.channel.on('refresh:display', observer);
    try {
      await f.app.start();
      await f.app.restart();
      await f.app.restart();
      let updates = 0;
      const view = f.app.getView();
      const update = view.update;
      view.update = function(...args) { updates++; return update.apply(this, args); };
      f.state.set('filter', 'closed');
      f.channel.trigger('refresh:display');
      assert.equal(updates, 2);
      assert.equal(independent, 1);
      await f.app.stop();
      f.state.set('filter', 'open');
      f.channel.trigger('refresh:display');
      assert.equal(updates, 2);
      assert.equal(independent, 2);
    } finally { await f.dispose(); }
  });

  await t.test('successful stop ends the timer and destroy cancels pending readiness', async() => {
    let ticks = 0;
    const f = fixture({ tick() { ticks++; } });
    try {
      await f.app.start();
      await delay(1100);
      assert.ok(ticks > 0);
      await f.app.stop();
      const stoppedTicks = ticks;
      await delay(1100);
      assert.equal(ticks, stoppedTicks);
    } finally { await f.dispose(); }
    const loading = Promise.withResolvers();
    let signal;
    const pending = fixture({ load(options) { signal = options.signal; return loading.promise; } });
    try {
      const start = pending.app.start();
      await pending.app.destroy();
      assert.equal(await start, false);
      assert.equal(signal.aborted, true);
      assert.equal(pending.channel.request('current:filter'), undefined);
      loading.resolve({ label: 'Late' });
      await loading.promise;
      assert.equal(document.querySelector('main').textContent, '');
    } finally { loading.resolve({ label: 'Done' }); await pending.dispose(); }
  });


  await t.test('a replacement start adopts pending stop permission and replaces effects once', async() => {
    const permission = Promise.withResolvers();
    let hold = true;
    const signals = [];
    const f = fixture({
      load({ signal }) { signals.push(signal); return Promise.resolve({ label: 'Queue' }); },
      beforeStop() { if (hold) { return permission.promise; } }
    });
    try {
      await f.app.start();
      const stopping = f.app.stop();
      const starting = f.app.start();
      assert.equal(await stopping, false);
      f.state.set('filter', 'closed');
      assert.equal(f.channel.request('current:filter'), 'closed');
      assert.equal(signals[0].aborted, false);
      permission.resolve();
      assert.equal(await starting, true);
      assert.equal(signals[0].aborted, true);
      assert.equal(signals.length, 2);
      assert.equal(signals[1].aborted, false);
      assert.equal(document.querySelector('main').textContent, 'Queue: closed');
    } finally { hold = false; permission.resolve(); await f.dispose(); }
  });

  await t.test('scope disposal is idempotent and releases late registered resources', () => {
    const effects = createEffects();
    const released = [];
    effects.add(() => released.push('first'));
    effects.add(() => released.push('second'));
    effects.dispose();
    effects.dispose();
    effects.add(() => released.push('late'));
    assert.equal(effects.signal.aborted, true);
    assert.deepEqual(released, ['second', 'first', 'late']);
  });
});
