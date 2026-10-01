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
    expect(late.isRunning()).toBe(true);
    await first.start();
    expect(first.isRunning()).toBe(true);
  });

  it('awaits explicitly chosen prerequisites with their own options and prepared host', async() => {
    const ready = gate();
    const entered = gate();
    const start = vi.fn();
    const childOptions = { section: 'queue' };
    const app = owner({
      async prepareStart() {
        this.setView(new View({ template: false }));
        const started = await this.getChildApp('required').start(childOptions);
        if (!started) { throw new Error('Required child unavailable'); }
      },
      onStart: start
    });
    const child = app.addChildApp('required', new (Application.extend({
      prepareStart(options) {
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
    const child = app.addChildApp('optional', new (Application.extend({ prepareStart() { return ready.promise; } }))());
    expect(await app.start()).toBe(true);
    const starting = child.start();
    expect(app.isRunning()).toBe(true);
    expect(child.isRunning()).toBe(false);
    ready.resolve();
    expect(await starting).toBe(true);
  });

  for (const method of ['stop', 'destroy']) {
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
      expect(app.isRunning()).toBe(false);
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
      const app = owner({ async prepareStart() {
        await this.getChildApp('first').start();
        await this.getChildApp('second').start();
      } });
      const first = app.addChildApp('first', new (Application.extend({ onStop() { stopped.push('first'); } }))());
      const second = app.addChildApp('second', new (Application.extend({
        prepareStart() { throw failure; },
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
    const app = owner({ async prepareStart() {
      await this.getChildApp('first').start();
      await this.getChildApp('second').start();
    } });
    app.addChildApp('first', new (Application.extend({ onStart: firstStarted }))());
    const second = app.addChildApp('second', new (Application.extend({ prepareStart() {
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
    const app = owner({ async prepareStart() {
      if (!await this.getChildApp('child').start()) { throw failure; }
    } });
    const child = app.addChildApp('child', new (Application.extend({ prepareStart() {
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

  it('allows explicit children in restart readiness and after stop cleanup', async() => {
    let blocked;
    let child;
    const app = owner({
      prepareStart() { return child.start(); },
      onStop() { blocked = child.start(); }
    });
    child = app.addChildApp('child', new Application());
    await app.start();
    expect(await app.restart()).toBe(true);
    expect(blocked).toBeUndefined();
    await app.stop();
    expect(await blocked).toBe(true);
    await app.start();
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

  for (const method of ['stop', 'destroy']) {
    it(`${method} cancels a child whose independent startup is pending`, async() => {
      const ready = gate();
      let signal;
      const app = owner();
      const child = app.addChildApp('child', new (Application.extend({ prepareStart(options, context) {
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
});

it('allows descendant activation after owner stop cleanup completes', async() => {
  let child;
  let duringStop;
  const app = owner({ onStop() { duringStop = child.start(); } });
  child = app.addChildApp('child', new Application());
  await app.start();
  expect(await app.stop()).toBe(true);
  expect(await duringStop).toBe(true);
  expect(child.isRunning()).toBe(true);
  expect(await child.start()).toBe(true);
});
