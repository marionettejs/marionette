/* global Cypress */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  for (const hook of hooks.after) { await hook().catch(() => {}); }
  root.remove();
  vi.unstubAllGlobals();
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
    expect(original.view.isDestroyed()).toBe(true);
    expect(created).toBe(false);
    disposal.resolve();
    const next = await replacing;
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
    expect(hooks.before[0]()).toBe(cleanup);
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
    expect(app.isDestroyed()).toBe(true);
    disposal.resolve();
    await cleaning;
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
  });
});
