import { afterEach, describe, expect, it } from 'vitest';
import { createMarionette } from 'marionette';

describe('Application restart completion boundary', function() {
  const owners = [];
  const gates = [];

  afterEach(async function() {
    gates.splice(0).forEach(resolve => resolve());
    for (const owner of owners.splice(0)) { await owner.destroy(); }
  });

  function gate() {
    let resolve;
    let reject;
    const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
    gates.push(resolve);
    return { promise, resolve, reject };
  }

  function createApp(properties) {
    const runtime = createMarionette();
    const App = runtime.Application.extend(properties);
    const app = new App();
    owners.push(app);
    return { app, runtime };
  }


  ['onStart', 'start event'].forEach(notification => {
    it(`starts a distinct cycle from ${notification} with its own options and root teardown`, async function() {
      const starts = [];
      const roots = [];
      let stops = 0;
      let nested;
      const options = { filter: 'next' };
      const { app, runtime } = createApp({
        onStart(owner, startOptions) {
          starts.push(startOptions);
          roots.push(this.setView(new runtime.View({ template: false })));
          if (notification === 'onStart' && starts.length === 2) { nested = this.restart(options); }
        },
        onStop() { stops += 1; }
      });
      if (notification === 'start event') {
        app.on('start', () => { if (starts.length === 2) { nested = app.restart(options); } });
      }
      await app.start({ filter: 'initial' });
      const outer = app.restart({ filter: 'outer' });
      expect(await outer).toBe(true);
      expect(nested).not.toBe(outer);
      expect(await nested).toBe(true);
      expect(starts).toEqual([{ filter: 'initial' }, { filter: 'outer' }, options]);
      expect(stops).toBe(0);
      expect(roots.map(root => root.isDestroyed())).toEqual([true, true, false]);
      expect(app.getView()).toBe(roots[2]);
      expect(app.isRunning()).toBe(true);
    });
  });


  it('keeps a completed restart successful when its completion-triggered cycle fails', async function() {
    const pending = gate();
    const entered = gate();
    let starts = 0;
    let preparations = 0;
    let nested;
    let outcome;
    const { app } = createApp({
      prepareStart() { if (++preparations === 3) { entered.resolve(); return pending.promise; } },
      onStart() {
        if (++starts === 2) {
          nested = this.restart();
          outcome = nested.then(value => ({ value }), error => ({ error }));
        }
      }
    });
    await app.start();
    const outer = app.restart();
    expect(await outer).toBe(true);
    await entered.promise;
    const error = new Error('next cycle failed');
    pending.reject(error);
    expect(await outcome).toEqual({ error });
    expect(await outer).toBe(true);
    expect(starts).toBe(2);
    expect(app.isRunning()).toBe(true);
  });

  it('keeps a completed restart successful when its completion-triggered cycle is canceled', async function() {
    const pending = gate();
    const entered = gate();
    let starts = 0;
    let preparations = 0;
    let nested;
    const { app } = createApp({
      prepareStart() { if (++preparations === 3) { entered.resolve(); return pending.promise; } },
      onStart() { if (++starts === 2) { nested = this.restart(); } }
    });
    await app.start();
    const outer = app.restart();
    expect(await outer).toBe(true);
    await entered.promise;
    expect(await app.stop()).toBe(true);
    expect(await nested).toBe(false);
    pending.resolve();
    await pending.promise;
    expect(await outer).toBe(true);
    expect(starts).toBe(2);
    expect(app.isRunning()).toBe(false);
  });
});
