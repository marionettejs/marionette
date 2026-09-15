import { afterEach, describe, expect, it, vi } from 'vitest';
import { Application, View } from 'marionette';

const owners = [];
const gates = [];
function gate() {
  const deferred = Promise.withResolvers();
  gates.push(deferred);
  return deferred;
}
function owner(methods = {}) {
  const app = new (Application.extend(methods))();
  owners.push(app);
  return app;
}
afterEach(async() => {
  gates.splice(0).forEach(deferred => deferred.resolve());
  for (const app of owners.splice(0)) { await app.destroy(); }
});

describe('Application child lifecycle', () => {
  it('registration never starts optional children, including after parent restart', async() => {
    const app = owner();
    const first = app.addChildApp('first', new Application());
    await app.start();
    const late = app.addChildApp('late', new Application());
    await late.start();
    await app.restart();
    expect(app.isRunning()).toBe(true);
    expect(first.isRunning()).toBe(false);
    expect(late.isRunning()).toBe(false);
    await first.start();
    expect(first.isRunning()).toBe(true);
  });

  it('awaits explicitly chosen prerequisites with their own options and prepared host', async() => {
    const ready = gate();
    const entered = gate();
    const start = vi.fn();
    const childOptions = { section: 'queue' };
    const app = owner({
      async onBeforeStart() {
        this.setView(new View({ template: false }));
        const started = await this.getChildApp('required').start(childOptions);
        if (!started) { throw new Error('Required child unavailable'); }
      },
      onStart: start
    });
    const child = app.addChildApp('required', new (Application.extend({
      onBeforeStart(childApp, options) {
        expect(options).toBe(childOptions);
        expect(app.getView()).toBeInstanceOf(View);
        entered.resolve();
        return ready.promise;
      }
    }))());
    const optional = app.addChildApp('optional', new Application());
    const starting = app.start({ unrelated: true });
    await entered.promise;
    expect(start).not.toHaveBeenCalled();
    ready.resolve();
    expect(await starting).toBe(true);
    expect(child.isRunning()).toBe(true);
    expect(optional.isRunning()).toBe(false);
  });

  it('allows a slow optional child to start independently after the owner', async() => {
    const ready = gate();
    const app = owner();
    const child = app.addChildApp('optional', new (Application.extend({ onBeforeStart() { return ready.promise; } }))());
    expect(await app.start()).toBe(true);
    const starting = child.start();
    expect(app.isRunning()).toBe(true);
    expect(child.isRunning()).toBe(false);
    ready.resolve();
    expect(await starting).toBe(true);
  });

  for (const method of ['stop', 'restart', 'destroy']) {
    it(`${method} drains a running grandchild through stopped owners`, async() => {
      const beforeStop = vi.fn();
      const beforeDestroy = vi.fn(() => expect(grandchild.isRunning()).toBe(false));
      const app = owner({ onBeforeStop: beforeStop, onBeforeDestroy: beforeDestroy });
      const child = app.addChildApp('child', new Application());
      const grandchild = child.addChildApp('grandchild', new Application());
      await grandchild.start();
      expect(await app[method]()).toBe(true);
      expect(grandchild.isRunning()).toBe(false);
      expect(child.isRunning()).toBe(false);
      expect(app.isRunning()).toBe(method === 'restart');
      expect(beforeStop).not.toHaveBeenCalled();
      if (method === 'destroy') { expect(beforeDestroy).toHaveBeenCalledTimes(1); }
      if (method !== 'destroy') {
        await grandchild.start();
        expect(grandchild.isRunning()).toBe(true);
        await app.stop();
        expect(grandchild.isRunning()).toBe(false);
      }
    });
  }

  for (const method of ['stop', 'destroy']) {
    it(`${method} cleans an explicitly started prefix after failed parent readiness`, async() => {
      const failure = new Error('Second child unavailable');
      const stopped = [];
      const app = owner({ async onBeforeStart() {
        await this.getChildApp('first').start();
        await this.getChildApp('second').start();
      } });
      const first = app.addChildApp('first', new (Application.extend({ onStop() { stopped.push('first'); } }))());
      const second = app.addChildApp('second', new (Application.extend({
        onBeforeStart() { throw failure; },
        onStop() { stopped.push('second'); }
      }))());
      await expect(app.start()).rejects.toBe(failure);
      expect(app.isRunning()).toBe(false);
      expect(first.isRunning()).toBe(true);
      expect(second.isRunning()).toBe(false);
      expect(await app[method]()).toBe(true);
      expect(first.isRunning()).toBe(false);
      expect(stopped).toEqual(['first']);
    });
  }

  it('retries an explicit startup without restarting its completed prerequisites', async() => {
    let failed = true;
    const firstStarted = vi.fn();
    const app = owner({ async onBeforeStart() {
      await this.getChildApp('first').start();
      await this.getChildApp('second').start();
    } });
    app.addChildApp('first', new (Application.extend({ onStart: firstStarted }))());
    const second = app.addChildApp('second', new (Application.extend({ onBeforeStart() {
      if (failed) { throw new Error('Not ready'); }
    } }))());
    await expect(app.start()).rejects.toThrow('Not ready');
    failed = false;
    expect(await app.start()).toBe(true);
    expect(firstStarted).toHaveBeenCalledTimes(1);
    expect(second.isRunning()).toBe(true);
  });

  it('lets application code reject readiness when a required child start is canceled', async() => {
    const ready = gate();
    const entered = gate();
    const failure = new Error('Required child canceled');
    const app = owner({ async onBeforeStart() {
      if (!await this.getChildApp('child').start()) { throw failure; }
    } });
    const child = app.addChildApp('child', new (Application.extend({ onBeforeStart() {
      entered.resolve();
      return ready.promise;
    } }))());
    const starting = app.start();
    const rejected = starting.catch(error => error);
    await entered.promise;
    await child.stop();
    expect(await rejected).toBe(failure);
    expect(app.isRunning()).toBe(false);
  });

  for (const method of ['stop', 'restart', 'destroy']) {
    it(`blocks descendant activation in the ${method} stop phase`, async() => {
      const ready = gate();
      const entered = gate();
      let hold = false;
      const app = owner({ onBeforeStop() {
        if (hold) { entered.resolve(); return ready.promise; }
      } });
      const child = app.addChildApp('child', new Application());
      const grandchild = child.addChildApp('grandchild', new Application());
      await app.start();
      hold = true;
      const stopping = app[method]();
      await entered.promise;
      expect(await child.start()).toBe(false);
      expect(await grandchild.restart()).toBe(false);
      ready.resolve();
      expect(await stopping).toBe(true);
      if (method !== 'destroy') { expect(await grandchild.start()).toBe(true); }
      hold = false;
    });
  }

  it('allows explicit children again in restart readiness, but not the stop completion hook', async() => {
    let blocked;
    let child;
    const app = owner({
      onBeforeStart() { return child.start(); },
      onStop() { blocked = child.start(); }
    });
    child = app.addChildApp('child', new Application());
    await app.start();
    expect(await app.restart()).toBe(true);
    expect(await blocked).toBe(false);
    expect(child.isRunning()).toBe(true);
  });

  it('rejects a child restart from its stop hook while owner teardown completes', async() => {
    let attempted;
    const app = owner();
    const child = app.addChildApp('child', new (Application.extend({ onStop() { attempted = this.restart(); } }))());
    await child.start();
    await app.start();
    expect(await app.stop()).toBe(true);
    expect(await attempted).toBe(false);
    expect(child.isRunning()).toBe(false);
  });

  it('stops independently started children sequentially before owner completion', async() => {
    const events = [];
    const options = { action: 'close' };
    const app = owner({ onBeforeStop() { events.push('owner:before'); }, onStop() { events.push('owner:stop'); } });
    for (const name of ['10', '2']) {
      const child = app.addChildApp(name, new (Application.extend({ onBeforeStop(childApp, received) {
        expect(received).toBe(options);
        events.push(name);
      } }))());
      await child.start();
    }
    await app.start();
    await app.stop(options);
    expect(events).toEqual(['owner:before', '10', '2', 'owner:stop']);
  });

  it('retains a stopped prefix when child stop fails and retries remaining children', async() => {
    const failure = new Error('Keep editing');
    const permission = { fail: true };
    const events = [];
    const app = owner();
    const children = [];
    for (const name of ['first', 'second', 'third']) {
      const child = app.addChildApp(name, new (Application.extend({
        onBeforeStop() { if (name === 'second' && permission.fail) { throw failure; } },
        onStop() { events.push(name); }
      }))());
      children.push(child);
      await child.start();
    }
    await app.start();
    await expect(app.stop()).rejects.toBe(failure);
    expect(app.isRunning()).toBe(true);
    expect(children.map(child => child.isRunning())).toEqual([false, true, true]);
    permission.fail = false;
    await app.stop();
    expect(events).toEqual(['first', 'second', 'third']);
  });

  it('retries destroy after an active child rejects stop beneath a stopped owner', async() => {
    const failure = new Error('Keep editing');
    let deny = true;
    const app = owner();
    const child = app.addChildApp('child', new (Application.extend({
      onBeforeStop() { if (deny) { throw failure; } }
    }))());
    try {
      await child.start();
      await expect(app.destroy()).rejects.toBe(failure);
      expect(app.isRunning()).toBe(false);
      expect(app.isDestroyed()).toBe(false);
      expect(app.getChildApp('child')).toBe(child);
      expect(child.isRunning()).toBe(true);
      expect(child.isDestroyed()).toBe(false);
      deny = false;
      expect(await app.destroy()).toBe(true);
      expect(app.isDestroyed()).toBe(true);
      expect(child.isDestroyed()).toBe(true);
      expect(app.getChildApp('child')).toBeUndefined();
    } finally {
      deny = false;
    }
  });

  for (const method of ['stop', 'destroy']) {
    it(`${method} cancels a child whose independent startup is pending`, async() => {
      const ready = gate();
      let signal;
      const app = owner();
      const child = app.addChildApp('child', new (Application.extend({ onBeforeStart(childApp, options, context) {
        signal = context.signal;
        return ready.promise;
      } }))());
      const starting = child.start();
      await app[method]();
      expect(await starting).toBe(false);
      expect(signal.aborted).toBe(true);
      ready.resolve();
      await ready.promise;
      expect(child.isRunning()).toBe(false);
    });
  }

  it('clears prepared roots beneath already-stopped children without inventing stop hooks', async() => {
    const stopped = vi.fn();
    const app = owner({ onStop: stopped });
    const child = app.addChildApp('child', new (Application.extend({ onStop: stopped }))());
    const view = child.setView(new View({ template: false }));
    await app.stop();
    await app.stop();
    expect(view.isDestroyed()).toBe(true);
    expect(stopped).not.toHaveBeenCalled();
  });

  for (const replacement of ['start', 'restart', 'destroy']) {
    it(`${replacement} adopts pending owner stop without reopening child activation`, async() => {
      const ready = gate();
      const entered = gate();
      let hold = false;
      const app = owner({ onBeforeStop() { if (hold) { entered.resolve(); return ready.promise; } } });
      const child = app.addChildApp('child', new Application());
      await child.start();
      await app.start();
      hold = true;
      const stopping = app.stop();
      await entered.promise;
      const next = app[replacement]();
      expect(await stopping).toBe(false);
      expect(await child.start()).toBe(false);
      ready.resolve();
      expect(await next).toBe(true);
      expect(child.isRunning()).toBe(replacement === 'start');
      hold = false;
    });
  }
});

['stop', 'restart', 'destroy'].forEach(method => {
  it(`begins a new stop phase when ${method} replaces a start after child stops were canceled`, async function() {
    const readiness = gate();
    const childStopping = gate();
    const events = [];
    const firstOptions = { source: 'first' };
    const latestOptions = { source: 'latest' };
    const ChildApplication = Application.extend({
      onBeforeStop() {
        if (this.getName() === 'first') {
          childStopping.resolve();
          return readiness.promise;
        }
      },
      onStop() { events.push(`${this.getName()}:stop`); }
    });
    const OwnerApplication = Application.extend({
      onBeforeStop(application, options) { events.push(options); },
      onStop() { events.push('parent:stop'); }
    });
    const parent = new OwnerApplication();
    owners.push(parent);
    const first = parent.addChildApp('first', new ChildApplication());
    const second = parent.addChildApp('second', new ChildApplication());
    await first.start();
    await second.start();
    await parent.start();

    const earlierStop = parent.stop(firstOptions);
    await childStopping.promise;
    const start = parent.start();
    const childStop = first.stop();
    readiness.resolve();
    await childStop;
    const latest = parent[method](latestOptions);

    expect(await Promise.all([earlierStop, start, latest])).to.deep.equal([false, false, true]);
    expect(events).to.deep.equal([firstOptions, 'first:stop', latestOptions, 'second:stop', 'parent:stop']);
    expect(parent.isRunning()).to.equal(method === 'restart');
    expect(first.isRunning()).toBe(false);
    expect(second.isRunning()).toBe(false);
    expect(parent.isDestroyed()).to.equal(method === 'destroy');
    expect(first.isDestroyed()).to.equal(method === 'destroy');
    expect(second.isDestroyed()).to.equal(method === 'destroy');

    await parent.destroy();
  });
});


for (const method of ['stop', 'destroy']) {
  it(`${method} handles direct child destruction during its awaited stop`, async() => {
    const ready = gate();
    const entered = gate();
    const app = owner();
    const child = app.addChildApp('child', new (Application.extend({ onBeforeStop() {
      entered.resolve();
      return ready.promise;
    } }))());
    await app.start();
    await child.start();
    const stopping = app[method]();
    await entered.promise;
    const destroying = child.destroy();
    ready.resolve();
    expect(await destroying).toBe(true);
    expect(await stopping).toBe(method === 'destroy');
    expect(child.isDestroyed()).toBe(true);
    expect(app.isRunning()).toBe(method === 'stop');
  });
}

it('preserves silent stopped-owner cleanup when restart adopts descendant stop readiness', async() => {
  const ready = gate();
  const entered = gate();
  const notifications = vi.fn();
  const app = owner({ onBeforeStop: notifications, onStop: notifications });
  const child = app.addChildApp('child', new (Application.extend({ onBeforeStop() {
    entered.resolve();
    return ready.promise;
  } }))());
  await child.start();
  const stopping = app.stop();
  await entered.promise;
  const restarting = app.restart();
  ready.resolve();
  expect(await stopping).toBe(false);
  expect(await restarting).toBe(true);
  expect(notifications).not.toHaveBeenCalled();
  expect(child.isRunning()).toBe(false);
});

it('blocks descendant activation inside owner stop completion until stop settles', async() => {
  let child;
  let duringStop;
  const app = owner({ onStop() { duringStop = child.start(); } });
  child = app.addChildApp('child', new Application());
  await app.start();
  expect(await app.stop()).toBe(true);
  expect(await duringStop).toBe(false);
  expect(child.isRunning()).toBe(false);
  expect(await child.start()).toBe(true);
});
