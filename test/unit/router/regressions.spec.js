import { afterEach, describe, expect, it, vi } from 'vitest';
import { Application } from 'marionette';
import { memoryDriver } from '@mnjs/router';
import { ChildAppSwitcher } from '@mnjs/router';
import { createRouter } from './helpers.js';

const owners = new Set();
const ownerFor = () => {
  const owner = new Application();
  owners.add(owner);
  return owner;
};
afterEach(() => {
  for (const owner of owners) { owner.destroy(); }
  owners.clear();
});
const gate = () => Promise.withResolvers();

function setup(options = {}) {
  const driver = options.driver ?? memoryDriver({ url: 'http://localhost/outside' });
  const router = createRouter({ routes: [{ name: 'page', path: '/page' }], ...options, driver });
  return { driver, router };
}

describe('cancellation and redirected readiness', () => {
  for (const kind of ['handler', 'redirect']) {
    it(`reports false after stopping pending ${ kind } work`, async() => {
      const pending = gate();
      const entered = gate();
      const ready = vi.fn();
      const error = vi.fn();
      const run = () => { entered.resolve(); return pending.promise; };
      const { router, driver } = setup(kind === 'handler' ? { handler: run } : {
        routes: [{ name: 'source', path: '/page', redirect: run }, { name: 'target', path: '/target' }],
      });
      router.on('route:ready', ready).on('route:error', error);
      await router.start();
      const result = router.navigate('/page');
      await entered.promise;
      expect(await result.committed).toBe(true);
      const match = router.getCurrent();
      router.stop();
      expect(match.signal.aborted).toBe(true);
      pending.resolve('/target');
      expect(await result.finished).toBe(false);
      expect(ready).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      expect(new URL(driver.currentEntry.url).pathname).toBe('/page');
    });
  }

  for (const failure of [false, true]) {
    it(`awaits redirected back ${ failure ? 'failure' : 'readiness' }`, async() => {
      let redirect = false;
      const pending = gate();
      const entered = gate();
      const { router } = setup({
        routes: [
          { name: 'source', path: '/source', redirect: () => redirect ? '/target' : undefined },
          { name: 'next', path: '/next' }, { name: 'target', path: '/target' },
        ],
        handler(match) { if (match.name === 'target') { entered.resolve(); return pending.promise; } },
      });
      await router.start();
      await router.navigate('/source').finished;
      await router.navigate('/next').finished;
      redirect = true;
      const result = router.back();
      const settled = vi.fn();
      result.then(settled, settled);
      await entered.promise;
      await Promise.resolve();
      expect(settled).not.toHaveBeenCalled();
      if (failure) {
        const error = new Error('target failed');
        pending.reject(error);
        await expect(result).rejects.toBe(error);
      } else {
        pending.resolve();
        expect(await result).toBe(true);
      }
      expect(router.getCurrent().name).toBe('target');
    });
  }

  it('does not give an unrelated navigation the pending traversal chain', async() => {
    const { router } = setup({ routes: [
      { name: 'source', path: '/source', redirect: () => '/page' }, { name: 'page', path: '/page' },
      { name: 'next', path: '/next' }, { name: 'other', path: '/other' },
    ] });
    await router.start();
    await router.navigate('/page').finished;
    await router.navigate('/next').finished;
    const back = router.back();
    const other = router.navigate('/other');
    expect(await other.finished).toBe(false);
    expect(await back).toBe(true);
    expect(router.getCurrent().name).toBe('page');
  });

  for (const initial of [false, true]) {
    it(`bounds synchronous redirect loops during ${ initial ? 'start' : 'navigate' }`, async() => {
      const { router } = setup({
        driver: memoryDriver({ url: initial ? 'http://localhost/item/123' : 'http://localhost/outside' }),
        maxRedirects: 2,
        routes: [{ name: 'item', path: '/item/:id', redirect: ({ params }) => ({ name: 'item', params }) }],
      });
      const errors = vi.fn();
      router.on('route:error', errors);
      if (initial) { await expect(router.start()).rejects.toThrow('Redirect limit of 2 exceeded'); } else {
        await router.start();
        await expect(router.navigate('/item/123').finished).rejects.toThrow('Redirect limit of 2 exceeded');
      }
      expect(errors).toHaveBeenCalledTimes(1);
    });
  }

  it('does not plan a navigation vetoed by an earlier listener', async() => {
    const { driver } = setup();
    const listeners = new AbortController();
    driver.addEventListener('navigate', event => event.preventDefault(), { signal: listeners.signal });
    const redirect = vi.fn(() => '/target');
    const { router } = setup({ driver, routes: [{ name: 'source', path: '/source', redirect }] });
    await router.start();
    expect(await router.navigate('/source').finished).toBe(false);
    expect(redirect).not.toHaveBeenCalled();
    expect(router.getCurrent()).toBeNull();
    listeners.abort();
  });

  it('rejects structured-clone values outside the promised plain-object state contract', async() => {
    const { router } = setup();
    await router.start();
    for (const state of [new Date(), new Map(), new Set()]) {
      expect(() => router.navigate('/page', { state })).toThrow(TypeError);
      expect(() => router.updateState(state)).toThrow(TypeError);
    }
    const state = Object.assign(Object.create(null), { tab: 'details' });
    expect(await router.navigate('/page', { state }).finished).toBe(true);
    expect(router.getCurrent().state).toEqual({ tab: 'details' });
  });
});

describe('Application selection and extension', () => {
  it('supports inherited initialization, methods, destruction hooks, and constructor delegation', async() => {
    const owner = ownerFor();
    const initialize = vi.fn();
    const onDestroy = vi.fn();
    const Extended = ChildAppSwitcher.extend({ initialize, onDestroy, label() { return 'selected'; } });
    function construct(options) { Extended.call(this, options); }
    const Delegating = Extended.extend({ constructor: construct });
    const switcher = owner.addChildApp('pages', new Delegating());
    const page = switcher.addChildApp('page', new Application());
    await switcher.start();
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(switcher.label()).toBe('selected');
    expect(await switcher.switchTo('page')).toBe(page);
    owner.destroy();
    expect(onDestroy).toHaveBeenCalledTimes(1);
    expect(switcher.isDestroyed()).toBe(true);
    expect(switcher.getCurrent()).toBeNull();
    expect(await switcher.switchTo('page')).toBeUndefined();
  });

  it('starts the replacement instance registered under the same name and key', async() => {
    const owner = ownerFor();
    const switcher = owner.addChildApp('pages', new ChildAppSwitcher());
    const first = switcher.addChildApp('page', new Application());
    await switcher.start();
    await switcher.switchTo('page', { key: { id: 'one' } });
    switcher.removeChildApp('page');
    const second = switcher.addChildApp('page', new Application());
    expect(await switcher.switchTo('page', { key: { id: 'one' } })).toBe(second);
    expect(first.isDestroyed()).toBe(true);
    expect(second.isRunning()).toBe(true);
    expect(switcher.getCurrent()).toBe(second);
  });

  it('leaves a child-owned replacement of its first preparation running', async() => {
    const owner = ownerFor();
    const first = gate();
    const replacement = gate();
    const replacing = gate();
    let runs = 0;
    let restarted;
    const Page = Application.extend({
      prepareStart() {
        runs++;
        if (runs === 1) {
          queueMicrotask(() => { restarted = this.restart(); replacing.resolve(); });
          return first.promise;
        }
        return replacement.promise;
      },
    });
    const switcher = owner.addChildApp('pages', new ChildAppSwitcher());
    const page = switcher.addChildApp('page', new Page());
    const stops = vi.fn();
    page.on('stop', stops);
    await switcher.start();
    const shown = switcher.switchTo('page');
    await replacing.promise;
    replacement.resolve();
    expect(await shown).toBeUndefined();
    expect(await restarted).toBe(true);
    first.resolve();
    expect(runs).toBe(2);
    expect(stops).not.toHaveBeenCalled();
    expect(page.isRunning()).toBe(true);
    expect(switcher.getCurrent()).toBe(page);
  });

  it('retains a selection when the group restarts itself during its first start notification', async() => {
    const owner = ownerFor();
    const switcher = owner.addChildApp('pages', new ChildAppSwitcher());
    const child = switcher.addChildApp('page', new Application());
    let shown;
    let restarted;
    switcher.once('start', () => {
      shown = switcher.switchTo('page');
      restarted = switcher.restart();
    });
    expect(await switcher.start()).toBe(true);
    expect(await restarted).toBe(true);
    expect(await shown).toBe(child);
    expect(switcher.getCurrent()).toBe(child);
  });

  it('keeps required selection and activation readiness explicit across nested owners', async() => {
    const owner = ownerFor();
    await owner.start();
    const sidebar = owner.addChildApp('sidebar', new Application());
    const pages = owner.addChildApp('pages', new ChildAppSwitcher());
    const page = pages.addChildApp('page', new ChildAppSwitcher());
    const details = page.addChildApp('details', new Application());
    await sidebar.start();
    await pages.start();
    const pending = gate();
    const entered = gate();
    const { router } = setup({ handler: async match => {
      const selected = await pages.switchTo('page', { signal: match.signal });
      if (!selected || match.signal.aborted) { return; }
      const detail = await selected.switchTo('details', { signal: match.signal });
      if (!detail || match.signal.aborted) { return; }
      entered.resolve();
      await pending.promise;
      match.signal.throwIfAborted();
    } });
    await router.start();
    const result = router.navigate('/page');
    const ready = vi.fn();
    result.finished.then(ready);
    await entered.promise;
    expect(page.isRunning()).toBe(true);
    expect(details.isRunning()).toBe(true);
    expect(ready).not.toHaveBeenCalled();
    pending.resolve();
    expect(await result.finished).toBe(true);
    pages.stop();
    expect(details.isRunning()).toBe(false);
    expect(sidebar.isRunning()).toBe(true);
    owner.stop();
    expect(details.isRunning()).toBe(false);
    expect(pages.getCurrent()).toBeNull();
  });
});

describe('public matching contracts', () => {
  it('rejects named URLs shadowed by a more specific route', () => {
    const { router } = setup({ routes: [
      { name: 'item', path: '/item/:id' }, { name: 'create', path: '/item/new' },
    ] });
    expect(() => router.url('item', { id: 'new' })).toThrow('do not round trip');
    expect(router.url('create')).toBe('/item/new');
    expect(router.match(router.url('item', { id: 'other' })).params).toEqual({ id: 'other' });
  });

  it('preserves slash and dot components inside scalar parameter values', () => {
    const { router } = setup({ routes: [{ name: 'file', path: '/file/:path' }] });
    for (const path of ['one/', 'one//two', 'one/two', 'a/../b', './a']) {
      const url = router.url('file', { path });
      expect(router.match(url).params.path).toBe(path);
    }
  });

  it('takes not-found params from the deepest unnamed prefix, including after mounts change', async() => {
    const { router } = setup({ routes: [{ name: 'root', path: '/' }],
      notFound: { name: 'missing', within: () => true },
    });
    await router.start();
    await router.navigate('/w1/unknown').finished;
    expect(router.getCurrent().params).toEqual({});
    const unmount = router.mount([{ path: '/:workspace', children: [
      { path: 'patient/:patientId', children: [{ name: 'workflow', path: 'workflow' }] },
    ] }]);
    await router.refresh();
    expect(router.getCurrent().params).toEqual({ workspace: 'w1' });
    await router.navigate('/a%20b/patient/p1/unknown').finished;
    expect(router.getCurrent().params).toEqual({ workspace: 'a b', patientId: 'p1' });
    await router.navigate('/%E0%A4%A/unknown').finished;
    expect(router.getCurrent().params).toEqual({});
    unmount();
    await router.refresh();
    expect(router.getCurrent().params).toEqual({});
  });
});

describe('selection cancellation ownership', () => {
  it('does not revive a child that stops itself before preparation', async() => {
    const owner = ownerFor();
    const prepare = vi.fn();
    const Page = Application.extend({ onBeforeStart() { this.stop(); }, prepareStart: prepare });
    const switcher = owner.addChildApp('pages', new ChildAppSwitcher());
    const page = switcher.addChildApp('page', new Page());
    await switcher.start();
    expect(await switcher.switchTo('page')).toBeUndefined();
    expect(prepare).not.toHaveBeenCalled();
    expect(page.isRunning()).toBe(false);
  });

  it('destroys the group children while leaving sibling features independent', async() => {
    const owner = ownerFor();
    const sidebar = owner.addChildApp('sidebar', new Application());
    const switcher = owner.addChildApp('pages', new ChildAppSwitcher());
    const page = switcher.addChildApp('page', new Application());
    await sidebar.start();
    await switcher.start();
    await switcher.switchTo('page');
    switcher.destroy();
    expect(switcher.getCurrent()).toBeNull();
    expect(page.isRunning()).toBe(false);
    expect(page.isDestroyed()).toBe(true);
    expect(owner.hasChildApp('pages')).toBe(false);
    expect(sidebar.isRunning()).toBe(true);
    expect(await switcher.switchTo('page')).toBeUndefined();
    owner.destroy();
    expect(page.isDestroyed()).toBe(true);
  });
});
