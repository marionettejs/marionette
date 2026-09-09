import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Application } from 'marionette';
import { Command, modelSettings } from './settings.js';

// The oracle keeps only consumer-visible stable state and ownership. A command
// is a bounded interaction with one explicitly held readiness phase, not a copy
// of Application's operation/phase implementation.
function fixture() {
  const real = { trace: [], gates: [], apps: [], automatic: false };
  real.create = name => {
    const holds = new Map();
    const before = (phase, options, context) => {
      real.trace.push(`${name}:before:${phase}`);
      const gate = holds.get(phase);
      holds.delete(phase);
      if (!gate || real.automatic) { return; }
      Object.assign(gate, { context, options, entered: true });
      context.signal.addEventListener('abort', () => real.trace.push(`${name}:abort:${phase}`), { once: true });
      return gate.promise;
    };
    const App = Application.extend({
      onBeforeStart(app, options, context) { return before('start', options, context); },
      onBeforeStop(app, options, context) { return before('stop', options, context); },
      onBeforeDestroy(app, options, context) { return before('destroy', options, context); },
      onStart() { real.trace.push(`${name}:start`); },
      onStop() { real.trace.push(`${name}:stop`); },
      onDestroy() { real.trace.push(`${name}:destroy`); }
    });
    const app = new App();
    real.apps.push(app);
    return { app, hold(phase) {
      let resolve;
      let reject;
      const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
      const gate = { promise, resolve, reject, entered: false };
      holds.set(phase, gate);
      real.gates.push(gate);
      return gate;
    } };
  };
  real.owner = real.create('owner');
  real.children = new Map();
  return real;
}

async function until(predicate) {
  for (let turn = 0; turn < 100 && !predicate(); turn++) { await Promise.resolve(); }
  expect(predicate(), 'bounded readiness progression').toBe(true);
}

async function settled(promise) {
  let done = false;
  const observed = promise.then(value => { done = true; return value; }, error => { done = true; throw error; });
  // Install rejection observation before progressing deferred work.
  const outcome = observed.then(value => ({ value }), error => ({ error }));
  await until(() => done);
  const result = await outcome;
  if (result.error) { throw result.error; }
  return result.value;
}

function verify(model, real) {
  expect(real.owner.app.isRunning()).toBe(model.running);
  expect(real.owner.app.isDestroyed()).toBe(model.destroyed);
  expect(Object.keys(real.owner.app.getChildApps())).toEqual([...model.children.keys()]);
  for (const [name, running] of model.children) {
    const child = real.children.get(name).app;
    expect(real.owner.app.getChildApp(name)).toBe(child);
    expect(child.getName()).toBe(name);
    expect(child.isRunning()).toBe(running);
    expect(child.isDestroyed()).toBe(false);
  }
}

function command(name, args, check, run) {
  return new Command(name, args, check, async(model, real) => {
    real.trace.length = 0;
    await run(model, real);
    model.completed++;
    verify(model, real);
  });
}

function target(model, method) {
  if (method === 'destroy') {
    model.destroyed = true;
    model.running = false;
    model.children.clear();
  } else {
    model.running = method !== 'stop';
    for (const name of model.children.keys()) { model.children.set(name, model.running); }
  }
}

const method = fc.constantFrom('start', 'stop', 'restart');
const commands = [
  method.map(operation => command('transition', [operation], () => true, async(model, real) => {
    const { app } = real.owner;
    const unchanged = model.destroyed || (operation === 'start' && model.running);
    const result = !(model.destroyed && ['start', 'restart'].includes(operation));
    expect(await settled(app[operation]())).toBe(result);
    if (!unchanged) { target(model, operation); }
  })),
  fc.constantFrom('a', 'b', 'c').map(name => command('register', [name], model =>
    !model.destroyed && !model.children.has(name), async(model, real) => {
    const child = real.create(name);
    real.children.set(name, child);
    expect(real.owner.app.addChildApp(name, child.app)).toBe(child.app);
    expect(real.owner.app.addChildApp(name, child.app)).toBe(child.app);
    model.children.set(name, false);
  })),
  fc.constantFrom('a', 'b', 'c').map(name => command('remove', [name], model =>
    model.children.has(name), async(model, real) => {
    const child = real.children.get(name).app;
    expect(await settled(real.owner.app.removeChildApp(name))).toBe(child);
    expect(child.isDestroyed()).toBe(true);
    model.children.delete(name);
  })),
  fc.tuple(fc.constantFrom('stop', 'restart', 'destroy'), fc.boolean(), fc.boolean())
    .map(([replacement, rejectLate, lateFirst]) => command('supersedeStart', [replacement, rejectLate, lateFirst], model =>
      !model.destroyed && !model.running && (replacement !== 'destroy' || model.completed >= 8), async(model, real) => {
      const { app } = real.owner;
      const gate = real.owner.hold('start');
      const first = app.start({ request: 'first' });
      expect(app.start({ request: 'duplicate' })).toBe(first);
      await until(() => gate.entered);
      expect(app.isRunning()).toBe(false);
      const winner = app[replacement]({ request: 'replacement' });
      expect(gate.context.signal.aborted).toBe(true);
      expect(real.trace.indexOf('owner:abort:start')).toBeLessThan(real.trace.indexOf('owner:before:stop'));
      expect(await settled(first)).toBe(false);
      const release = () => rejectLate ? gate.reject(new Error('obsolete loader')) : gate.resolve();
      if (lateFirst) { release(); }
      expect(await settled(winner)).toBe(true);
      target(model, replacement);
      const completed = [...real.trace];
      if (!lateFirst) { release(); }
      // Await the consumer's old readiness and its already-installed framework
      // reactions; this must not append a stale start or change stable state.
      await gate.promise.catch(() => {});
      await Promise.resolve();
      expect(real.trace).toEqual(completed);
      expect(real.trace.filter(event => event === 'owner:start')).toHaveLength(replacement === 'restart' ? 1 : 0);
    })),
  fc.constantFrom('start', 'restart', 'destroy').map(replacement => command('adoptStop', [replacement], model =>
    !model.destroyed && model.running && (replacement !== 'destroy' || model.completed >= 8), async(model, real) => {
    const { app } = real.owner;
    const gate = real.owner.hold('stop');
    const options = { request: 'original stop' };
    const first = app.stop(options);
    expect(app.stop()).toBe(first);
    await until(() => gate.entered);
    const context = gate.context;
    const winner = app[replacement]({ request: 'replacement' });
    expect(app[replacement]()).toBe(winner);
    expect(await settled(first)).toBe(false);
    expect(gate.options).toBe(options);
    expect(context.signal.aborted).toBe(false);
    expect(app.isRunning()).toBe(false);
    expect(real.trace.filter(event => event === 'owner:before:stop')).toHaveLength(1);
    gate.resolve();
    expect(await settled(winner)).toBe(true);
    expect(gate.context).toBe(context);
    expect(real.trace).not.toContain('owner:abort:stop');
    expect(real.trace.filter(event => event === 'owner:stop')).toHaveLength(replacement === 'start' ? 0 : 1);
    target(model, replacement);
  })),
  fc.constantFrom('start', 'stop').map(phase => command('childSupersedesOwner', [phase], model =>
    !model.destroyed && model.children.size > 0 && model.running === (phase === 'stop') &&
    [...model.children.values()].every(running => running === model.running), async(model, real) => {
    const names = [...model.children.keys()];
    const name = names[0];
    const child = real.children.get(name);
    const gate = child.hold(phase);
    const ownerOperation = real.owner.app[phase]();
    await until(() => gate.entered);
    const opposite = phase === 'start' ? 'stop' : 'start';
    const childOperation = child.app[opposite]();
    gate.resolve();
    expect(await settled(childOperation)).toBe(true);
    expect(await settled(ownerOperation)).toBe(false);
    expect(real.trace).not.toContain(`owner:${phase}`);
    for (const later of names.slice(1)) { expect(real.trace).not.toContain(`${later}:before:${phase}`); }
    // The canceled owner keeps its earlier stable state; the opposing child
    // operation restores that child's same state, without rolling back siblings.
  })),
  fc.constant(null).map(() => command('terminalReadiness', [], model => !model.destroyed && model.completed >= 8, async(model, real) => {
    const gate = real.owner.hold('destroy');
    const first = real.owner.app.destroy();
    await until(() => gate.entered);
    expect(real.owner.app.destroy()).toBe(first);
    expect(await settled(real.owner.app.start())).toBe(false);
    expect(await settled(real.owner.app.restart())).toBe(false);
    for (const child of real.children.values()) {
      expect(await settled(child.app.start())).toBe(false);
      expect(await settled(child.app.restart())).toBe(false);
    }
    const stopped = real.owner.app.stop();
    gate.resolve();
    expect(await settled(stopped)).toBe(true);
    expect(await settled(first)).toBe(true);
    target(model, 'destroy');
  })),
  fc.constant(null).map(() => command('rejectCurrentStart', [], model => !model.destroyed && !model.running, async(model, real) => {
    const gate = real.owner.hold('start');
    const error = new Error('current loader failed');
    const result = real.owner.app.start().then(value => ({ value }), failure => ({ failure }));
    await until(() => gate.entered);
    gate.reject(error);
    expect(await settled(result)).toEqual({ failure: error });
    expect(real.trace).not.toContain('owner:start');
  }))
];

describe('Application public asynchronous sequences', () => {
  it('preserves winning readiness, stable state, and child ownership across bounded interleavings', { timeout: 120000 }, async() => {
    const settings = modelSettings();
    await fc.assert(fc.asyncProperty(fc.commands([
      commands[0], commands[1], commands[1], commands[3], commands[3], ...commands
    ], settings.commands), async sequence => {
      const real = fixture();
      const model = { running: false, destroyed: false, children: new Map(), completed: 0 };
      try {
        await fc.asyncModelRun(() => ({ model, real }), sequence);
        verify(model, real);
      } finally {
        real.automatic = true;
        real.gates.forEach(gate => gate.resolve());
        for (const app of real.apps) { await settled(app.destroy()); }
      }
    }), settings.assert);
  });
});
