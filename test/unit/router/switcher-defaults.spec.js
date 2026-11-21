import assert from 'node:assert/strict';
import { afterEach, it } from 'vitest';
import { Application } from 'marionette';
import { RouteApplication } from '@mnjs/router';

const owners = [];
afterEach(() => { for (const app of owners.splice(0)) { app.destroy(); } });
function owner(Group = RouteApplication, options) { const app = new Group(options); owners.push(app); return app; }

it('uses restart only from the call while preserving the registered instance', async() => {
  let constructed = 0;
  const starts = [];
  const Group = RouteApplication.extend({ options: { restart: true } });
  const pages = owner(Group, { restart: true });
  const page = pages.addChildApp('page', new (Application.extend({
    initialize() { constructed++; },
    onStart(_app, options) { starts.push(options.id); },
  }))());
  await pages.start();
  await pages.switchTo('page', { key: 'one', options: { id: 'first' } });
  await pages.switchTo('page', { key: 'one', options: { id: 'ignored' } });
  await pages.switchTo('page', { key: 'one', restart: true, options: { id: 'restarted' } });
  await pages.switchTo('page', { key: 'one', restart: false, options: { id: 'ignored-again' } });
  assert.deepEqual(starts, ['first', 'restarted']);
  assert.equal(pages.getCurrent(), page);
  assert.equal(constructed, 1);
});

it('same-key callers share pending preparation and its outcome', async() => {
  const gate = Promise.withResolvers();
  let preparations = 0;
  const pages = owner();
  const page = pages.addChildApp('page', new (Application.extend({ prepareStart() { preparations++; return gate.promise; } }))());
  await pages.start();
  const first = pages.switchTo('page', { key: 'one' });
  const second = pages.switchTo('page', { key: 'one' });
  gate.resolve();
  assert.equal(await first, page);
  assert.equal(await second, page);
  assert.equal(preparations, 1);
});

it('an explicit restart replaces pending work without reconstructing its child', async() => {
  const gates = [];
  const signals = [];
  const pages = owner();
  const page = pages.addChildApp('page', new (Application.extend({
    prepareStart(_options, { signal }) { signals.push(signal); const gate = Promise.withResolvers(); gates.push(gate); return gate.promise; },
  }))());
  await pages.start();
  const first = pages.switchTo('page', { key: 'one' });
  const second = pages.switchTo('page', { key: 'one', restart: true });
  assert.equal(await first, undefined);
  assert.equal(signals[0].aborted, true);
  assert.equal(signals[1].aborted, false);
  gates[1].resolve();
  assert.equal(await second, page);
  gates[0].reject(new Error('obsolete preparation'));
  await Promise.resolve();
  assert.equal(pages.getCurrent(), page);
});

it('caller cancellation leaves shared preparation available to another caller', async() => {
  const gate = Promise.withResolvers();
  const controller = new AbortController();
  let lifecycleSignal;
  const pages = owner();
  const page = pages.addChildApp('page', new (Application.extend({
    prepareStart(_options, { signal }) { lifecycleSignal = signal; return gate.promise; },
  }))());
  await pages.start();
  const first = pages.switchTo('page', { key: 'one', signal: controller.signal });
  controller.abort();
  const second = pages.switchTo('page', { key: 'one' });
  gate.resolve();
  assert.equal(await first, undefined);
  assert.equal(await second, page);
  assert.equal(lifecycleSignal.aborted, false);
});

it('changed keys still restart when the call explicitly disables forced restart', async() => {
  const starts = [];
  const pages = owner();
  const page = pages.addChildApp('page', new (Application.extend({ onStart(_app, options) { starts.push(options.id); } }))());
  await pages.start();
  await pages.switchTo('page', { key: 'one', options: { id: 'one' } });
  await pages.switchTo('page', { key: 'two', restart: false, options: { id: 'two' } });
  assert.deepEqual(starts, ['one', 'two']);
  assert.equal(pages.getCurrent(), page);
});
