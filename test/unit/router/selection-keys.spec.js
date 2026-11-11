import { afterEach, describe, expect, it, vi } from 'vitest';
import { Application } from 'marionette';
import { ChildAppSwitcher } from '@mnjs/router';

const groups = new Set();
afterEach(() => { for (const pages of groups) { pages.destroy(); } groups.clear(); });
async function setup(Page = Application) {
  const pages = new ChildAppSwitcher();
  groups.add(pages);
  const page = pages.addChildApp('page', new Page());
  await pages.start();
  return { pages, page };
}

describe('selection key value snapshots', () => {
  it('restarts with new options after the original nested key is mutated', async() => {
    const runs = [];
    const Page = Application.extend({ onStart(_app, options) { runs.push(options.id); } });
    const { pages, page } = await setup(Page);
    const key = { resource: { id: '1' } };
    await pages.switchTo('page', { key, options: { id: '1' } });
    key.resource.id = '2';
    expect(await pages.switchTo('page', { key, options: { id: '2' } })).toBe(page);
    expect(runs).toEqual(['1', '2']);
    await pages.switchTo('page', { key: { resource: { id: '2' } }, options: { id: 'ignored' } });
    expect(runs).toEqual(['1', '2']);
  });

  it('captures the key before a child start callback can mutate it', async() => {
    const key = { id: '1' };
    const start = vi.fn(() => { key.id = '2'; });
    const Page = Application.extend({ onBeforeStart: start });
    const { pages } = await setup(Page);
    await pages.switchTo('page', { key });
    await pages.switchTo('page', { key: { id: '2' } });
    expect(start).toHaveBeenCalledTimes(2);
  });

  it('captures the incoming key before retiring the previous child', async() => {
    const { pages, page } = await setup();
    const previous = pages.addChildApp('previous', new Application());
    await pages.switchTo('previous');
    const key = { id: '2' };
    previous.once('stop', () => { key.id = '3'; });
    await pages.switchTo('page', { key });
    const stop = vi.fn();
    page.on('stop', stop);
    await pages.switchTo('page', { key: { id: '3' } });
    expect(stop).toHaveBeenCalledTimes(1);
  });

  for (const [caseIndex, [first, second, reuse]] of [
    [new Array(2), [1, 2], false], [[1, 2], new Array(2), false],
    [new Array(1), [undefined], false], [[undefined], new Array(1), false],
    [new Array(2), new Array(2), true],
    [[1], [1, 2], false],
    [NaN, NaN, true], [-0, 0, false], [Infinity, Infinity, true],
    [undefined, null, false],
    [{ a: [1, { b: undefined }], c: null }, { c: null, a: [1, { b: undefined }] }, true],
  ].entries()) {
    it(`compares structural values symmetrically (case ${caseIndex}, reuse ${reuse})`, async() => {
      const { pages, page } = await setup();
      await pages.switchTo('page', { key: first });
      const stop = vi.fn();
      page.on('stop', stop);
      await pages.switchTo('page', { key: second });
      expect(stop).toHaveBeenCalledTimes(reuse ? 0 : 1);
      expect(pages.getCurrent()).toBe(page);
    });
  }

  it('reuses equal aliased subtrees across different sharing layouts', async() => {
    const { pages, page } = await setup();
    const leaf = { id: 'one' };
    const shared = { left: leaf, right: leaf };
    await pages.switchTo('page', { key: shared });
    const stop = vi.fn();
    page.on('stop', stop);
    const equalLeaf = { id: 'one' };
    await pages.switchTo('page', { key: { left: equalLeaf, right: equalLeaf } });
    await pages.switchTo('page', { key: { left: { id: 'one' }, right: { id: 'one' } } });
    expect(stop).not.toHaveBeenCalled();
    leaf.id = 'two';
    await pages.switchTo('page', { key: shared });
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('supports frozen and null-prototype data, aliasing and the own __proto__ key without changing callers', async() => {
    const { pages, page } = await setup();
    const shared = Object.freeze({ id: 'one' });
    const key = Object.freeze(Object.assign(Object.create(null), { a: shared, b: shared }));
    await pages.switchTo('page', { key });
    const stop = vi.fn();
    page.on('stop', stop);
    await pages.switchTo('page', { key: { a: { id: 'one' }, b: { id: 'one' } } });
    expect(stop).not.toHaveBeenCalled();
    expect(Object.getPrototypeOf(key)).toBeNull();
    expect(Object.isFrozen(key)).toBe(true);
    const special = JSON.parse('{"__proto__":{"id":"one"}}');
    await pages.switchTo('page', { key: special });
    await pages.switchTo('page', { key: JSON.parse('{"__proto__":{"id":"one"}}') });
    expect(stop).toHaveBeenCalledTimes(1);
    expect(Object.getPrototypeOf(special)).toBe(Object.prototype);
  });

  const cycle = {}; cycle.self = cycle;
  const arrayCycle = []; arrayCycle.push(arrayCycle);
  const accessor = Object.defineProperty({}, 'id', { enumerable: true, get() { throw new Error('must not invoke'); } });
  const hidden = Object.defineProperty({}, 'id', { value: 1 });
  const extra = []; extra.id = 'one';
  for (const [label, key] of [
    ['Date', new Date()], ['class', new class Key {}()], ['Map', new Map()],
    ['function', () => {}], ['symbol', Symbol('id')], ['bigint', 1n],
    ['object cycle', cycle], ['array cycle', arrayCycle], ['accessor', accessor],
    ['hidden property', hidden], ['symbol property', { [Symbol('id')]: 1 }], ['array property', extra],
  ]) {
    it(`rejects ${label} before retiring a valid selection`, async() => {
      const { pages, page } = await setup();
      await pages.switchTo('page', { key: 'valid' });
      const stop = vi.fn(); page.on('stop', stop);
      await expect(pages.switchTo('page', { key })).rejects.toBeInstanceOf(TypeError);
      expect(stop).not.toHaveBeenCalled();
      expect(pages.getCurrent()).toBe(page);
      expect(page.isRunning()).toBe(true);
    });
  }

  it('does not let invalid input supersede a pending valid caller', async() => {
    const work = Promise.withResolvers();
    const Page = Application.extend({ prepareStart() { return work.promise; } });
    const { pages, page } = await setup(Page);
    const selecting = pages.switchTo('page', { key: { id: 'one' } });
    await expect(pages.switchTo('page', { key: cycle })).rejects.toBeInstanceOf(TypeError);
    work.resolve();
    expect(await selecting).toBe(page);
  });

  it('preserves newer selection intent entered by the old child stop hook', async() => {
    const { pages, page } = await setup();
    const other = pages.addChildApp('other', new Application());
    await pages.switchTo('page', { key: { id: '1' } });
    let latest;
    page.once('stop', () => { latest = pages.switchTo('other', { key: { id: 'new' } }); });
    expect(await pages.switchTo('page', { key: { id: '2' } })).toBeUndefined();
    expect(await latest).toBe(other);
    expect(pages.getCurrent()).toBe(other);
  });
});
