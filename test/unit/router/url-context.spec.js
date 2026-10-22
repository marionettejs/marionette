import { describe, it, vi } from 'vitest';
import assert from 'node:assert/strict';
import { Router, memoryDriver } from '@mnjs/router';
import { createRouter } from './helpers.js';

const initialUrl = 'https://example.test/section/current';
const routes = [{ name: 'item', path: '/items/:id' }];

describe('Router URL context', () => {
  it('uses the Driver URL for relative matching before start without subscriptions', () => {
    const driver = memoryDriver({ url: initialUrl });
    const subscribe = vi.spyOn(driver, 'addEventListener');
    const router = createRouter({ driver, routes: [...routes, { name: 'local', path: '/section/items/:id' }] });
    assert.equal(router.match('/items/7').url.href, 'https://example.test/items/7');
    assert.equal(router.match('items/7').url.href, 'https://example.test/section/items/7');
    assert.equal(driver.currentEntry.url, initialUrl);
    assert.equal(router.getCurrent(), null);
    assert.equal(subscribe.mock.calls.length, 0);
    router.destroy();
    assert.equal(router.match('/items/7').url.origin, 'https://example.test');
  });

  it('keeps absolute matching and URL generation independent of any Driver', () => {
    const router = createRouter({ routes });
    const url = new URL('https://other.example/items/7?q=one#part');
    assert.equal(router.match(url).url, url);
    assert.equal(router.match(url.href).url.href, url.href);
    assert.equal(router.url('item', { id: '7' }), '/items/7');
    assert.throws(() => router.match('/items/7'), /Navigation API/);
  });

  it('does not read a supplied Driver for absolute matching', () => {
    const memory = memoryDriver({ url: initialUrl });
    let reads = 0;
    const driver = { ...memory, get currentEntry() { reads++; return memory.currentEntry; } };
    const router = createRouter({ driver, routes });
    assert.equal(router.match('https://other.example/items/7').name, 'item');
    assert.equal(router.match(new URL('https://other.example/items/7')).name, 'item');
    assert.equal(reads, 0);
  });

  it('supports relative matching during initialize with an explicit Driver', () => {
    const driver = memoryDriver({ url: initialUrl });
    const subscribe = vi.spyOn(driver, 'addEventListener');
    let matched;
    const Routes = Router.extend({
      routes,
      initialize() { matched = this.match('/items/7'); },
    });
    const router = new Routes({ driver });
    try {
      assert.equal(matched.url.href, 'https://example.test/items/7');
      assert.equal(subscribe.mock.calls.length, 0);
      assert.equal(router.getCurrent(), null);
    } finally { router.destroy(); }
  });
});

describe('Generated pathname normalization', () => {
  for (const [path, params] of [
    ['/café/:id', { id: 'é space' }],
    ['/space here/:id', { id: 'one' }],
    ['/space%20', {}],
    ['/a/./one', {}],
    ['/a/x/../one', {}],
    ['/a/x/%2e%2e/one', {}],
    ['/encoded/%3F/%23/:id', { id: 'one/two?three#four\\five' }],
  ]) {
    it(`keeps browser-equivalent route and parameters for ${ path }`, () => {
      const router = createRouter({ routes: [{ name: 'item', path }] });
      const generated = router.url('item', params);
      const parsed = new URL(generated, initialUrl);
      const match = router.match(parsed);
      assert.equal(match.name, 'item');
      assert.deepEqual(match.params, params);
      assert.equal(generated, parsed.pathname);
      assert.equal(parsed.origin, new URL(initialUrl).origin);
    });
  }

  it('preserves percent-escape spelling without decoding static delimiters', () => {
    const router = createRouter({ routes: [{ name: 'item', path: '/encoded/%3f/%23/:id' }] });
    assert.equal(router.url('item', { id: '%2F' }), '/encoded/%3f/%23/%252F');
  });

  for (const path of [String.raw`/\/outside.example/:id`, '/\t/outside.example/:id']) {
    it(`rejects generated network references for ${ JSON.stringify(path) }`, () => {
      const router = createRouter({ routes: [{ name: 'item', path }] });
      assert.throws(() => router.url('item', { id: 'one' }), /do not round trip/);
    });
  }

  it('rejects generated paths incompatible with trailing-slash matching', () => {
    const router = createRouter({ routes: [{ name: 'item', path: '/a/.' }] });
    assert.throws(() => router.url('item'), /do not round trip/);
  });

  it('keeps dot-segment matching and rejects dot-valued parameters', () => {
    const router = createRouter({ routes: [{ name: 'item', path: '/a/:id' }] });
    for (const path of ['/a/./one', '/a/x/../one', '/a/x/%2e%2e/one']) {
      assert.deepEqual(router.match(new URL(path, initialUrl)).params, { id: 'one' });
    }
    for (const id of ['.', '..']) {
      assert.throws(() => router.url('item', { id }), /do not round trip/);
    }
  });

  for (const path of [String.raw`/a\\b/:id`, String.raw`/\\outside.example/:id`]) {
    it(`continues rejecting generated literal backslashes for ${ path }`, () => {
      const router = createRouter({ routes: [{ name: 'item', path }] });
      assert.throws(() => router.url('item', { id: 'one' }), /do not round trip/);
    });
  }
});

describe('own-property persisted parameters', () => {
  for (const key of ['constructor', 'toString', '__proto__']) {
    it(`persists own ${ key } values and respects explicit clearing`, async() => {
      const driver = memoryDriver({ url: 'https://example.test/one/page' });
      const router = createRouter({ driver, persistParams: [key], routes: [
        { name: 'page', path: `/:${ key }/page` }, { name: 'other', path: `/:${ key }/other` },
      ] });
      await router.start();
      assert.equal(router.url('other'), '/one/other');
      assert.equal(router.url('other', Object.create({ [key]: 'inherited' })), '/one/other');
      for (const value of [undefined, null, '']) {
        assert.throws(() => router.url('other', Object.fromEntries([[key, value]])), /missing param/);
      }
      assert.equal(router.url('other', Object.fromEntries([[key, 'two']])), '/two/other');
    });
  }
});
