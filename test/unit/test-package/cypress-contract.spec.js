/* global Cypress */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountView } from '@mnjs/test';

// This models the documented queue/hook boundary. It does not execute Cypress.
let adapter;
let root;
let hooks;
let queue;
let Application;
let Card;
beforeEach(async() => {
  vi.resetModules();
  const core = await import('marionette');
  Application = core.Application;
  Card = core.View.extend({ template: () => '<button>Open</button>' });
  hooks = { before: [], after: [] };
  root = document.body.appendChild(document.createElement('main'));
  root.setAttribute('data-cy-root', '');
  queue = Promise.resolve();
  vi.stubGlobal('beforeEach', callback => hooks.before.push(callback));
  vi.stubGlobal('afterEach', callback => hooks.after.push(callback));
  vi.stubGlobal('Cypress', {
    testingType: 'component',
    Commands: { add: vi.fn(), overwrite: vi.fn() }, on: vi.fn(), log: vi.fn()
  });
  vi.stubGlobal('cy', { then(options, callback) {
    queue = queue.then(callback);
    queue.catch(() => {});
    return queue;
  } });
  adapter = await import('@mnjs/test/cypress');
});
afterEach(async() => {
  try { for (const hook of hooks.after) { await hook(); } } finally {
    root.remove();
    vi.unstubAllGlobals();
  }
});

describe('Cypress adapter non-runtime contract', () => {
  it('registers no import side effects and requires explicit component setup', async() => {
    expect(Cypress.Commands.add).not.toHaveBeenCalled();
    expect(Cypress.Commands.overwrite).not.toHaveBeenCalled();
    expect(hooks.before).toEqual([]);
    expect(hooks.after).toEqual([]);
    await expect(adapter.mount(new Card())).rejects.toThrow('Call setupCypress()');
    Cypress.testingType = 'e2e';
    expect(() => adapter.setupCypress()).toThrow('requires Cypress component testing');
    Cypress.testingType = 'component';
    adapter.setupCypress();
    adapter.setupCypress();
    expect(hooks.before).toHaveLength(1);
    expect(hooks.after).toHaveLength(1);
    expect(Cypress.Commands.add).not.toHaveBeenCalled();
    // The real mount-utils callback installs restrictions, not async disposal.
    expect(Cypress.Commands.overwrite.mock.calls.map(args => args[0])).toEqual(['visit', 'session', 'origin']);
    expect(Cypress.on).toHaveBeenCalledOnce();
    await hooks.before[0]();
    Cypress.on.mock.calls[0][1]();
  });

  it('queues factories after previous async disposal and keeps roots as direct children', async() => {
    adapter.setupCypress();
    const began = Promise.withResolvers();
    const disposal = Promise.withResolvers();
    const original = await adapter.mount(scope => {
      scope.defer(() => { began.resolve(); return disposal.promise; });
      return new Card();
    });
    expect(original.el.parentNode).toBe(root);
    expect(Cypress.log.mock.calls[0][0].consoleProps()).toBe(original);
    const nextView = new Card();
    let created = false;
    const replacing = adapter.mount(() => { created = true; return nextView; }, { log: false });
    await began.promise;
    expect(original.view.isDestroyed()).toBe(false);
    expect(created).toBe(false);
    disposal.resolve();
    const next = await replacing;
    expect(original.view.isDestroyed()).toBe(true);
    expect(next.view).toBe(nextView);
    expect(next.el.parentNode).toBe(root);
    expect(root.children).toHaveLength(1);
    expect(Cypress.log).toHaveBeenCalledOnce();
    const third = new Card();
    next.region.show(third);
    expect(third.el.parentNode).toBe(root);
    await adapter.unmount();
    expect(third.isDestroyed()).toBe(true);
    expect(root.children).toHaveLength(0);
  });

  it('mounts an existing View and returns awaited before/after cleanup promises', async() => {
    adapter.setupCypress();
    const view = new Card();
    const handle = await adapter.mount(view);
    const cleanup = hooks.after[0]();
    expect(cleanup).toBeInstanceOf(Promise);
    expect(hooks.after[0]()).toBe(cleanup);
    await cleanup;
    expect(handle.region.isDestroyed()).toBe(true);
    expect(view.isDestroyed()).toBe(true);
    expect(root.isConnected).toBe(true);
  });

  it('rejects missing roots with the real mount-utils diagnostic', async() => {
    adapter.setupCypress();
    root.removeAttribute('data-cy-root');
    await expect(adapter.mount(new Card())).rejects.toThrow('data-cy-root');
  });

  it('requires an explicit application startup choice and allows manual shell rendering', async() => {
    adapter.setupCypress();
    expect(() => adapter.mountApplication(() => new Application())).toThrow('requires an explicit');
    expect(() => adapter.mountApplication(() => new Application(), { start: 'yes' })).toThrow('requires an explicit');
    let starts = 0;
    const Feature = Application.extend({ onStart() { starts++; } });
    const handle = await adapter.mountApplication(region => new Feature({ region }), { start: false });
    expect(starts).toBe(0);
    await expect(handle.ready).resolves.toBe(false);
    handle.app.showView(new Card());
    expect(handle.el.parentNode).toBe(root);
    await handle.app.start();
    expect(starts).toBe(1);
  });

  it('waits for explicit startup and forwards start options', async() => {
    adapter.setupCypress();
    const Feature = Application.extend({ onStart(app, options) { this.showView(new Card({ id: options.id })); } });
    const handle = await adapter.mountApplication(region => new Feature({ region }), { start: true, startOptions: { id: 'ready' } });
    expect(handle.app.isRunning()).toBe(true);
    expect(handle.el.id).toBe('ready');
    expect(handle.el.parentNode).toBe(root);
  });

  it('cancels pending startup before a slow project disposer without waiting for the queue', async() => {
    adapter.setupCypress();
    const preparation = Promise.withResolvers();
    const began = Promise.withResolvers();
    const disposal = Promise.withResolvers();
    let signal;
    let app;
    const Feature = Application.extend({ prepareStart(options, context) { signal = context.signal; began.resolve(); return preparation.promise; } });
    const mounting = adapter.mountApplication((region, scope) => {
      scope.defer(() => disposal.promise);
      app = new Feature({ region });
      return app;
    }, { start: true });
    const rejected = mounting.catch(error => error);
    await began.promise;
    const cleaning = hooks.after[0]();
    expect(signal.aborted).toBe(true);
    expect(app.isDestroyed()).toBe(false);
    disposal.resolve();
    await cleaning;
    expect(app.isDestroyed()).toBe(true);
    expect(await rejected).toMatchObject({ message: 'Mounted Application startup was cancelled.' });
    preparation.resolve();
  });

  it('releases project resources after a failed View factory', async() => {
    adapter.setupCypress();
    const failure = new Error('factory failed');
    const actions = [];
    await expect(adapter.mount(scope => {
      scope.defer(() => actions.push('disposed'));
      throw failure;
    })).rejects.toBe(failure);
    expect(actions).toEqual(['disposed']);
    expect(root.children).toHaveLength(0);
  });

  it('retains mount and project cleanup failures together', async() => {
    adapter.setupCypress();
    const mountFailure = new Error('factory');
    const cleanupFailure = new Error('project cleanup');
    const error = await adapter.mount(scope => {
      scope.defer(() => { throw cleanupFailure; });
      throw mountFailure;
    }).catch(value => value);
    expect(error.errors[0]).toBe(mountFailure);
    expect(error.errors[1].errors[0].errors).toEqual([cleanupFailure]);
    await expect(hooks.after[0]()).rejects.toThrow('project cleanup');
    hooks.after = [];
  });

  it('keeps test fixtures across remounts while local services finish before each shell', async() => {
    adapter.setupCypress();
    const fixtures = await adapter.testScope();
    const events = [];
    fixtures.defer(() => events.push('fixture'));
    let firstScope;
    const First = Card.extend({ onDestroy() { events.push('first shell'); } });
    const first = await adapter.mount((scope, testScope) => {
      firstScope = scope;
      expect(testScope).toBe(fixtures);
      scope.defer(() => events.push('first service'));
      return new First();
    });
    expect(first.scope).toBe(firstScope);
    expect(first.testScope).toBe(fixtures);
    const Second = Card.extend({ onDestroy() { events.push('second shell'); } });
    const second = await adapter.mount(() => new Second());
    expect(events).toEqual(['first service', 'first shell']);
    expect(() => first.scope.defer(() => {})).toThrow('Cannot register');
    expect(second.testScope).toBe(fixtures);
    second.scope.defer(() => events.push('second service'));
    await adapter.unmount();
    expect(events).toEqual(['first service', 'first shell', 'second service', 'second shell']);
    expect(await adapter.testScope()).toBe(fixtures);
    await hooks.after[0]();
    expect(events.at(-1)).toBe('fixture');
    await hooks.before[0]();
    expect(await adapter.testScope()).not.toBe(fixtures);
  });

  it('requires setup before accessing test fixtures', async() => {
    await expect(adapter.testScope()).rejects.toThrow('Call setupCypress()');
  });

  it('shares test fixtures with Application factories without sharing mount resources', async() => {
    adapter.setupCypress();
    const fixtures = await adapter.testScope();
    let local;
    const mounted = await adapter.mountApplication((region, scope, testScope) => {
      local = scope;
      expect(testScope).toBe(fixtures);
      return new Application({ region });
    }, { start: false });
    expect(mounted.scope).toBe(local);
    expect(mounted.testScope).toBe(fixtures);
  });

  it('releases test fixtures when mount teardown fails and preserves both errors', async() => {
    adapter.setupCypress();
    const local = new Error('local disposal');
    const test = new Error('fixture disposal');
    const fixtures = await adapter.testScope();
    fixtures.defer(() => { throw test; });
    const mounted = await adapter.mount(() => new Card());
    mounted.scope.defer(() => { throw local; });
    const error = await hooks.after[0]().catch(value => value);
    expect(error.message).toContain('local disposal');
    expect(error.message).toContain('fixture disposal');
    expect(error.errors).toHaveLength(2);
    expect(error.errors[0].errors[0].errors).toEqual([local]);
    expect(error.errors[1].errors).toEqual([test]);
    expect(mounted.view.isDestroyed()).toBe(true);
    // The modeled automatic hook failure has been observed; don't report it twice.
    hooks.after = [];
  });

  it('surfaces a fixture-only teardown rejection', async() => {
    adapter.setupCypress();
    const failure = new Error('fixture');
    const fixtures = await adapter.testScope();
    fixtures.defer(() => { throw failure; });
    await expect(hooks.after[0]()).rejects.toMatchObject({ errors: [failure] });
    hooks.after = [];
  });


  it('preserves asynchronous startup and mounted-resource cleanup errors together', async() => {
    adapter.setupCypress();
    const startup = new Error('startup');
    const disposal = new Error('disposal');
    let attempts = 0;
    const Feature = Application.extend({ prepareStart() { throw startup; } });
    const error = await adapter.mountApplication((region, scope) => {
      scope.defer(() => { attempts++; throw disposal; });
      return new Feature({ region });
    }, { start: true }).catch(value => value);
    expect(error.errors[0]).toBe(startup);
    expect(error.message).toContain('disposal');
    expect(attempts).toBe(1);
    await expect(hooks.after[0]()).rejects.toThrow('disposal');
    expect(attempts).toBe(1);
    hooks.after = [];
  });


  it.each([false, true])('awaits nested neutral acquisition cleanup (disposal fails: %s)', async fails => {
    adapter.setupCypress();
    const failure = new Error('nested factory');
    const disposal = new Error('nested disposal');
    let released = false;
    const error = await adapter.mount(() => {
      mountView(scope => {
        scope.defer(async() => {
          await Promise.resolve();
          released = true;
          if (fails) { throw disposal; }
        });
        throw failure;
      });
    }).catch(value => value);
    expect(released).toBe(true);
    if (fails) {
      expect(error.errors[0]).toBe(failure);
      expect(error.errors[1].errors).toEqual([disposal]);
    } else { expect(error).toBe(failure); }
  });


  it.each([null, 7])('preserves a non-Error factory failure: %s', async failure => {
    adapter.setupCypress();
    await expect(adapter.mount(() => { throw failure; })).rejects.toBe(failure);
  });

});
