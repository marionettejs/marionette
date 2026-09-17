import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Application } from 'marionette';
import { createReviewSession } from '../solution.mjs';

const turn = () => new Promise(resolve => setImmediate(resolve));
function queue() {
  const pending = [];
  const waiting = [];
  const all = [];
  return {
    all,
    call(input, context) {
      const gate = { ...Promise.withResolvers(), input, context };
      all.push(gate);
      if (waiting.length) { waiting.shift()(gate); } else { pending.push(gate); }
      return gate.promise;
    },
    next() { return pending.length ? Promise.resolve(pending.shift()) : new Promise(resolve => waiting.push(resolve)); }
  };
}
function resources() {
  const callbacks = new Set();
  let released = 0;
  let acquired = 0;
  return {
    callbacks,
    get released() { return released; },
    get acquired() { return acquired; },
    register(callback) {
      acquired++;
      callbacks.add(callback);
      return () => {
        assert.equal(callbacks.delete(callback), true, 'release each registration exactly once');
        released++;
      };
    },
    emit(value) { for (const callback of callbacks) { callback(value); } }
  };
}
function setup(t) {
  const loading = queue();
  const validating = queue();
  const permissions = queue();
  const subscriptions = resources();
  const timers = resources();
  const values = { label: 'previous', draft: '', status: 'offline' };
  let disposed = 0;
  const state = {
    get(key) { return values[key]; },
    set(key, value) { values[key] = value; },
    dispose() { disposed++; }
  };
  let permissionRequired = false;
  let pulses = 0;
  const session = createReviewSession({ state,
    load: (id, context) => loading.call(id, context),
    validate: (value, context) => validating.call(value, context),
    beforeStop: (options, context) => permissionRequired ? permissions.call(options, context) : Promise.resolve(),
    subscribe: callback => subscriptions.register(callback),
    schedule: callback => timers.register(callback),
    onPulse() { pulses++; }
  });
  t.after(async() => {
    permissionRequired = false;
    for (const channel of [loading, validating, permissions]) {
      for (const gate of channel.all) { gate.resolve('cleanup'); }
    }
    await session.app.destroy();
  }, { timeout: 3000 });
  assert.ok(session.app instanceof Application);
  return { ...session, state, loading, validating, permissions, subscriptions, timers,
    get disposed() { return disposed; }, get pulses() { return pulses; },
    requirePermission() { permissionRequired = true; },
    async complete(value) {
      const load = await loading.next();
      load.resolve(value);
      const validation = await validating.next();
      assert.equal(validation.input, value);
      validation.resolve();
    },
    async start(id = 'initial') {
      const result = session.app.start({ id });
      await this.complete(id);
      assert.equal(await result, true);
    }
  };
}
const options = { timeout: 3000 };

test('working startup, edits, refresh errors and repeated resource cycles survive repair', options, async t => {
  const c = setup(t);
  c.edit('unsaved draft');
  assert.equal(c.state.get('label'), 'previous');
  assert.equal(c.state.get('status'), 'offline');
  await c.start();
  assert.equal(c.state.get('label'), 'initial');
  for (let cycle = 0; cycle < 3; cycle++) {
    assert.equal(c.subscriptions.callbacks.size, 1);
    assert.equal(c.timers.callbacks.size, 1);
    c.subscriptions.emit(`status-${cycle}`);
    c.timers.emit();
    assert.equal(c.state.get('status'), `status-${cycle}`);
    assert.equal(c.pulses, cycle + 1);
    const refreshing = c.refresh(`refresh-${cycle}`);
    await c.complete(`updated-${cycle}`);
    assert.equal(await refreshing, true);
    const failed = c.refresh('failed');
    const rejected = assert.rejects(failed, /offline/);
    (await c.loading.next()).reject(new Error('offline'));
    await rejected;
    assert.equal(c.state.get('label'), `updated-${cycle}`);
    assert.equal(c.state.get('draft'), 'unsaved draft');
    assert.equal(await c.app.stop(), true);
    assert.equal(c.subscriptions.callbacks.size, 0);
    assert.equal(c.timers.callbacks.size, 0);
    assert.equal(await c.refresh('stopped'), false);
    if (cycle < 2) { await c.start(`restart-${cycle}`); }
  }
  assert.equal(c.subscriptions.released, 3);
  assert.equal(c.timers.released, 3);
});

test('canceled loading never validates or commits its late value', options, async t => {
  const c = setup(t);
  const starting = c.app.start({ id: 'old' });
  const old = await c.loading.next();
  const loadsBeforeRefresh = c.loading.all.length;
  assert.equal(await c.refresh('during-start'), false);
  await turn();
  assert.equal(c.loading.all.length, loadsBeforeRefresh);
  await c.app.stop();
  assert.equal(await starting, false);
  old.resolve('obsolete');
  await turn();
  assert.equal(c.validating.all.length, 0);
  assert.equal(c.state.get('label'), 'previous');
  assert.equal(c.subscriptions.callbacks.size, 0);
});

test('late validation cannot overwrite a newer successful start', options, async t => {
  const c = setup(t);
  const starting = c.app.start({ id: 'old' });
  (await c.loading.next()).resolve('old');
  const oldValidation = await c.validating.next();
  await c.app.stop();
  assert.equal(await starting, false);
  await c.start('new');
  oldValidation.resolve();
  await turn();
  assert.equal(c.state.get('label'), 'new');
  assert.equal(c.subscriptions.callbacks.size, 1);
});

test('refresh replacement, obsolete errors and successful stop invalidate pending work', options, async t => {
  const c = setup(t);
  await c.start();
  const old = c.refresh('old');
  (await c.loading.next()).resolve('old');
  const oldValidation = await c.validating.next();
  const fresh = c.refresh('new');
  await c.complete('new');
  assert.equal(await fresh, true);
  oldValidation.resolve();
  assert.equal(await old, false);
  assert.equal(c.state.get('label'), 'new');
  const staleError = c.refresh('stale-error');
  const loadError = await c.loading.next();
  const pending = c.refresh('pending');
  (await c.loading.next()).resolve('pending');
  const validation = await c.validating.next();
  loadError.reject(new Error('obsolete failure'));
  assert.equal(await staleError, false);
  await c.app.stop();
  validation.resolve();
  assert.equal(await pending, false);
  assert.equal(c.state.get('label'), 'new');
});

test('rejected stop preserves delivery, heartbeat, editing and pending refresh', options, async t => {
  const c = setup(t);
  await c.start();
  c.requirePermission();
  const stopping = c.app.stop();
  stopping.catch(() => {});
  const permission = await c.permissions.next();
  c.subscriptions.emit('still connected');
  c.timers.emit();
  c.edit('pending draft');
  assert.equal(c.state.get('label'), 'initial');
  assert.equal(c.state.get('status'), 'still connected');
  assert.equal(c.pulses, 1);
  assert.equal(c.subscriptions.released, 0);
  assert.equal(c.timers.released, 0);
  const loadCount = c.loading.all.length;
  const refreshing = c.refresh('pending-stop-refresh');
  await turn();
  assert.equal(c.loading.all.length, loadCount + 1, 'refresh remains usable during pending stop');
  (await c.loading.next()).resolve('updated');
  const validation = await c.validating.next();
  permission.reject(new Error('keep editing'));
  await assert.rejects(stopping, /keep editing/);
  validation.resolve();
  assert.equal(await refreshing, true);
  assert.equal(c.app.isRunning(), true);
  assert.equal(c.state.get('label'), 'updated');
  assert.equal(c.state.get('draft'), 'pending draft');
});

test('destroy adopts stop permission and prevents late refresh commits', options, async t => {
  const c = setup(t);
  await c.start();
  const refreshing = c.refresh('late');
  (await c.loading.next()).resolve('late');
  const validation = await c.validating.next();
  c.requirePermission();
  const stopping = c.app.stop();
  const permission = await c.permissions.next();
  const destroying = c.app.destroy();
  assert.equal(permission.context.signal.aborted, false);
  permission.resolve();
  assert.equal(await stopping, false);
  assert.equal(await destroying, true);
  assert.equal(c.permissions.all.length, 1);
  validation.resolve();
  assert.equal(await refreshing, false);
  assert.equal(c.state.get('label'), 'initial');
  assert.equal(c.subscriptions.callbacks.size, 0);
  assert.equal(c.timers.callbacks.size, 0);
  assert.equal(await c.refresh('destroyed'), false);
  assert.equal(await c.app.start({ id: 'destroyed' }), false);
});

test('startup validation failure preserves data and acquires no resources', options, async t => {
  const c = setup(t);
  c.edit('retained');
  const starting = c.app.start({ id: 'invalid' });
  const rejected = assert.rejects(starting, /invalid/);
  (await c.loading.next()).resolve('invalid');
  (await c.validating.next()).reject(new Error('invalid'));
  await rejected;
  assert.equal(c.state.get('label'), 'previous');
  assert.equal(c.state.get('draft'), 'retained');
  assert.equal(c.subscriptions.callbacks.size, 0);
  assert.equal(c.timers.callbacks.size, 0);
  await c.start('retry');
});

test('borrowed source survives destruction for another consumer', options, async t => {
  const c = setup(t);
  assert.equal(c.app.getState(), c.state);
  await c.start();
  await c.app.destroy();
  assert.equal(c.disposed, 0);
  assert.equal(c.subscriptions.callbacks.size, 0);
  assert.equal(c.timers.callbacks.size, 0);
  assert.equal(c.subscriptions.released, 1);
  assert.equal(c.timers.released, 1);
  c.state.set('draft', 'another consumer');
  assert.equal(c.state.get('draft'), 'another consumer');
});

test('refresh validation errors respect replacement and preserve data for retry', options, async t => {
  const c = setup(t);
  await c.start();
  c.edit('retained draft');
  const obsolete = c.refresh('obsolete');
  obsolete.catch(() => {});
  (await c.loading.next()).resolve('obsolete');
  const staleValidation = await c.validating.next();
  const fresh = c.refresh('new');
  await c.complete('new');
  assert.equal(await fresh, true);
  staleValidation.reject(new Error('obsolete validation failure'));
  assert.equal(await obsolete, false);
  assert.equal(c.state.get('label'), 'new');
  const invalid = c.refresh('invalid');
  const rejected = assert.rejects(invalid, /current validation failure/);
  (await c.loading.next()).resolve('invalid');
  (await c.validating.next()).reject(new Error('current validation failure'));
  await rejected;
  assert.equal(c.state.get('label'), 'new');
  assert.equal(c.state.get('draft'), 'retained draft');
  assert.equal(c.subscriptions.callbacks.size, 1);
  const retry = c.refresh('retry');
  await c.complete('retry');
  assert.equal(await retry, true);
  assert.equal(c.state.get('label'), 'retry');
});

test('start superseding pending stop leaves one active resource pair', options, async t => {
  const c = setup(t);
  await c.start();
  c.requirePermission();
  const stopping = c.app.stop();
  const permission = await c.permissions.next();
  const starting = c.app.start({ id: 'replacement' });
  permission.resolve();
  assert.equal(await stopping, false);
  const loading = await c.loading.next();
  const loadCount = c.loading.all.length;
  assert.equal(await c.refresh('during-replacement'), false);
  await turn();
  assert.equal(c.loading.all.length, loadCount);
  loading.resolve('replacement');
  (await c.validating.next()).resolve();
  assert.equal(await starting, true);
  assert.equal(c.subscriptions.callbacks.size, 1);
  assert.equal(c.timers.callbacks.size, 1);
  assert.equal(c.subscriptions.acquired - c.subscriptions.released, 1);
  assert.equal(c.timers.acquired - c.timers.released, 1);
  c.timers.emit();
  assert.equal(c.pulses, 1);
  const destroying = c.app.destroy();
  (await c.permissions.next()).resolve();
  assert.equal(await destroying, true);
  assert.equal(c.subscriptions.callbacks.size, 0);
  assert.equal(c.timers.callbacks.size, 0);
  assert.equal(c.subscriptions.released, c.subscriptions.acquired);
  assert.equal(c.timers.released, c.timers.acquired);
});

for (const stage of ['load', 'validation']) {
  test(`failed replacement ${stage} releases resources and allows retry`, options, async t => {
    const c = setup(t);
    await c.start();
    c.edit('retained draft');
    c.requirePermission();
    const stopping = c.app.stop();
    const permission = await c.permissions.next();
    const starting = c.app.start({ id: 'replacement' });
    const rejected = assert.rejects(starting, /replacement failed/);
    permission.resolve();
    assert.equal(await stopping, false);
    const loading = await c.loading.next();
    if (stage === 'load') {
      loading.reject(new Error('replacement failed'));
    } else {
      loading.resolve('replacement');
      (await c.validating.next()).reject(new Error('replacement failed'));
    }
    await rejected;
    assert.equal(c.app.isRunning(), false);
    assert.equal(c.subscriptions.callbacks.size, 0);
    assert.equal(c.timers.callbacks.size, 0);
    assert.equal(c.subscriptions.released, c.subscriptions.acquired);
    assert.equal(c.timers.released, c.timers.acquired);
    assert.equal(c.state.get('label'), 'initial');
    assert.equal(c.state.get('draft'), 'retained draft');
    const loadCount = c.loading.all.length;
    assert.equal(await c.refresh('stopped'), false);
    await turn();
    assert.equal(c.loading.all.length, loadCount);
    assert.equal(await c.app.stop(), true);
    await c.start('retry');
    assert.equal(c.subscriptions.callbacks.size, 1);
    assert.equal(c.timers.callbacks.size, 1);
  });
}
