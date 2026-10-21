import { afterEach, describe, expect, it, vi } from 'vitest';
import { Application } from 'marionette';
import { memoryDriver } from '@mnjs/router';
import { ChildAppSwitcher } from '@mnjs/router';
import { createRouter } from './helpers.js';

const owners = new Set();
function own() {
  const owner = new Application();
  owners.add(owner);
  return owner;
}
afterEach(() => {
  for (const owner of owners) { owner.destroy(); }
  owners.clear();
});
function intercept(driver) {
  const controller = new AbortController();
  driver.addEventListener('navigate', event => event.intercept(), { signal: controller.signal });
  return controller;
}

describe('grouped and embedded route parameters', () => {
  for (const [path, url, params] of [
    ['/item-:id', '/item-42', { id: '42' }],
    ['/item{/part/:id}', '/item/part/42', { id: '42' }],
    ['/item{/part/:id}*', '/item/part/42', { id: '42' }],
    ['/item{/part/:id}+', '/item/part/42', { id: '42' }],
  ]) {
    it(`matches and generates ${ path }`, () => {
      const router = createRouter({ routes: [{ name: 'item', path }] });
      expect(router.match(url).params).toEqual(params);
      expect(router.url('item', params)).toBe(url);
      expect(router.match('/item/part/42/extra')).toBeNull();
    });
  }

  it('omits a repeatable optional group when no parameter is supplied', () => {
    const router = createRouter({ routes: [{ name: 'item', path: '/item{/part/:id}*' }] });
    expect(router.url('item')).toBe('/item');
    expect(router.match('/item').name).toBe('item');
  });

  it('rejects an unfinished escape instead of accepting a different pathname', () => {
    expect(() => createRouter({ routes: [{ name: 'bad', path: '/bad\\' }] })).toThrow('Invalid path');
  });

  it('rejects an alias with parameters when its canonical route has none', () => {
    expect(() => createRouter({ routes: [{ name: 'item', path: '/item', aliases: [{ path: '/:id' }] }] }))
      .toThrow('must declare exactly the params: (none)');
  });
});

describe('navigation query and entry-state boundaries', () => {
  for (const [query, search] of [
    [null, ''], ['one=two', '?one=two'], [new URLSearchParams('two=three'), '?two=three'],
  ]) {
    it(`replaces raw URL query with ${ String(query) }`, async() => {
      const router = createRouter({ driver: memoryDriver(), routes: [{ name: 'item', path: '/item' }] });
      await router.start();
      expect(await router.navigate('/item?old=1', { query }).finished).toBe(true);
      expect(router.getCurrent().url.search).toBe(search);
    });
  }

  it('replaces foreign non-object state with an explicit plain-object update', async() => {
    const driver = memoryDriver();
    const listeners = intercept(driver);
    await driver.navigate('/item', { state: new Map([['old', 1]]) }).finished;
    listeners.abort();
    const router = createRouter({ driver, routes: [{ name: 'item', path: '/item' }] });
    await router.start();
    router.updateState({ tab: 'details' });
    expect(driver.currentEntry.getState()).toEqual({ tab: 'details' });
    expect(router.getCurrent().state).toEqual({ tab: 'details' });
  });

  it('propagates a driver back failure without poisoning the next traversal', async() => {
    const memory = memoryDriver();
    const failure = new Error('driver failed');
    let fail = true;
    let redirect = false;
    const driver = { ...memory, get currentEntry() { return memory.currentEntry; }, back() {
      if (fail) { throw failure; }
      return memory.back();
    } };
    const router = createRouter({ driver, routes: [
      { name: 'a', path: '/a', redirect: () => redirect ? '/target' : undefined },
      { name: 'b', path: '/b' }, { name: 'target', path: '/target' },
    ] });
    await router.start();
    await router.navigate('/a').finished;
    await router.navigate('/b').finished;
    expect(() => router.back()).toThrow(failure);
    fail = false;
    redirect = true;
    expect(await router.back()).toBe(true);
    expect(router.getCurrent().name).toBe('target');
  });
});

describe('memory driver queued traversal and event semantics', () => {
  it('rejects invalid history modes and unsupported listener event types', () => {
    const driver = memoryDriver();
    expect(() => driver.navigate('/a', { history: 'invalid' })).toThrow(TypeError);
    expect(() => driver.addEventListener('other', () => {})).toThrow(TypeError);
  });

  it('rejects unclonable reload state and leaves the current entry intact', async() => {
    const driver = memoryDriver();
    const entry = driver.currentEntry;
    const result = driver.reload({ state: { callback() {} } });
    await expect(result.committed).rejects.toMatchObject({ name: 'DataCloneError' });
    await expect(result.finished).rejects.toMatchObject({ name: 'DataCloneError' });
    expect(driver.currentEntry).toBe(entry);
  });

  it('rejects a queued traversal when its forward entry is removed before dispatch', async() => {
    const driver = memoryDriver();
    const listeners = intercept(driver);
    const initial = driver.currentEntry.key;
    await driver.navigate('/a').finished;
    const forward = driver.currentEntry.key;
    await driver.traverseTo(initial).finished;
    const traversal = driver.traverseTo(forward);
    await driver.navigate('/replacement').finished;
    await expect(traversal.committed).rejects.toMatchObject({ name: 'InvalidStateError' });
    await expect(traversal.finished).rejects.toMatchObject({ name: 'InvalidStateError' });
    expect(driver.entries().map(entry => new URL(entry.url).pathname)).toEqual(['/', '/replacement']);
    listeners.abort();
  });

  it('coalesces queued traversals when the first already reaches the destination', async() => {
    const driver = memoryDriver();
    const listeners = intercept(driver);
    const initial = driver.currentEntry.key;
    await driver.navigate('/a').finished;
    const first = driver.traverseTo(initial);
    const second = driver.traverseTo(initial);
    const [one, two] = await Promise.all([first.finished, second.finished]);
    expect(one.key).toBe(initial);
    expect(two).toBe(one);
    expect(driver.currentEntry.key).toBe(initial);
    listeners.abort();
  });

  it('does not cancel a navigation when preventDefault is called after dispatch', async() => {
    const driver = memoryDriver();
    const listeners = new AbortController();
    let seen;
    driver.addEventListener('navigate', event => { seen = event; event.intercept(); }, { signal: listeners.signal });
    const result = driver.navigate('/a');
    seen.preventDefault();
    expect(seen.defaultPrevented).toBe(false);
    expect((await result.finished).url).toBe('http://localhost/a');
    listeners.abort();
  });

  it('does not call a listener whose signal an earlier listener aborts during dispatch', async() => {
    const driver = memoryDriver();
    const first = new AbortController();
    const second = new AbortController();
    const late = vi.fn();
    driver.addEventListener('navigate', event => { second.abort(); event.intercept(); }, { signal: first.signal });
    driver.addEventListener('navigate', late, { signal: second.signal });
    await driver.navigate('/a').finished;
    expect(late).not.toHaveBeenCalled();
    expect(driver.currentEntry.url).toBe('http://localhost/a');
    first.abort();
  });

  it('reports listener failures asynchronously while continuing native-style event dispatch', async() => {
    const driver = memoryDriver();
    const listeners = new AbortController();
    const failure = new Error('listener failed');
    const scheduled = [];
    vi.spyOn(globalThis, 'queueMicrotask').mockImplementation(callback => scheduled.push(callback));
    const next = vi.fn(event => event.intercept());
    driver.addEventListener('navigate', () => { throw failure; }, { signal: listeners.signal });
    driver.addEventListener('navigate', next, { signal: listeners.signal });
    expect((await driver.navigate('/a').finished).url).toBe('http://localhost/a');
    expect(next).toHaveBeenCalledTimes(1);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]).toThrow(failure);
    listeners.abort();
  });
});

describe('switcher selection lifetime boundaries', () => {
  it('reconstructs a selection when an object key becomes an array key', async() => {
    const owner = own();
    let preparations = 0;
    const Page = Application.extend({ prepareStart() { preparations++; } });
    const page = owner.addChildApp('page', new Page());
    const switcher = new ChildAppSwitcher({ owner });
    await switcher.switchTo('page', { key: { id: 'one' } });
    expect(await switcher.switchTo('page', { key: ['one'] })).toBe(page);
    expect(preparations).toBe(2);
  });

  it('preserves a new selection explicitly started from owner stop notification', async() => {
    const owner = own();
    await owner.start();
    owner.addChildApp('a', new Application());
    const b = owner.addChildApp('b', new Application());
    const switcher = new ChildAppSwitcher({ owner });
    await switcher.switchTo('a');
    let shown;
    owner.onStop = () => { shown = switcher.switchTo('b'); };
    owner.stop();
    expect(await shown).toBe(b);
    expect(switcher.getCurrent()).toBe(b);
    expect(b.isRunning()).toBe(true);
  });

  it('preserves the startup failure when cleanup fails without an optional cleanup callback', async() => {
    const owner = own();
    const failure = new Error('preparation failed');
    const cleanup = new Error('cleanup failed');
    const Page = Application.extend({
      childApps: { nested: Application },
      async prepareStart() { await this.getChildApp('nested').start(); throw failure; },
    });
    const page = owner.addChildApp('page', new Page());
    const nested = page.getChildApp('nested');
    nested.onBeforeStop = () => { throw cleanup; };
    const switcher = new ChildAppSwitcher({ owner });
    await expect(switcher.switchTo('page')).rejects.toBe(failure);
    expect(switcher.getCurrent()).toBe(page);
    nested.onBeforeStop = () => {};
  });

  it('ignores an old replacement failure after stop notification selects a newer child', async() => {
    const owner = own();
    const current = owner.addChildApp('current', new Application());
    const latest = owner.addChildApp('latest', new Application());
    owner.addChildApp('obsolete', new Application());
    const switcher = new ChildAppSwitcher({ owner });
    await switcher.switchTo('current');
    let shown;
    current.onBeforeStop = () => { shown = switcher.switchTo('latest'); throw new Error('obsolete stop failed'); };
    expect(await switcher.switchTo('obsolete')).toBeUndefined();
    current.onBeforeStop = () => {};
    expect(await shown).toBe(latest);
    expect(switcher.getCurrent()).toBe(latest);
  });
});
