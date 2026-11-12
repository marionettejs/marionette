import assert from 'node:assert/strict';
import { it } from 'vitest';
import { memoryDriver } from '@mnjs/router';
import { createRouter } from './helpers.js';

it('rejects URL-shaped route names in array, hash and nested definitions at registration', () => {
  for (const name of ['/', '/named', '//example.test/path', 'https://elsewhere.test/', 'HTTPS://elsewhere.test/', 'a+b.c-d://host/path']) {
    for (const routes of [[{ name, path: '/expected' }], { '/expected': { name } }, {
      '/parent': { children: [{ name, path: 'expected' }] },
    }]) {
      assert.throws(() => createRouter({ routes }), /Route name .* is reserved for URL navigation/);
    }
  }
});

it('keeps ordinary and non-URL punctuation names available for URL generation and navigation', async() => {
  const names = ['catalog:item', '?tab', '#details', 'http:item', 'file:/item', 'router//item', 'constructor', '__proto__'];
  const routes = names.map((name, index) => ({ name, path: `/item-${index}` }));
  const driver = memoryDriver({ url: 'https://routes.example/outside' });
  const router = createRouter({ driver, routes });
  await router.start(); await router.getInitialDispatch();
  for (const [index, name] of names.entries()) {
    assert.equal(router.url(name), `/item-${index}`);
    assert.equal(await router.navigate(name).finished, true);
    assert.equal(driver.currentEntry.url, `https://routes.example/item-${index}`);
    assert.equal(router.getCurrent().name, name);
  }
});

it('rejects a reserved name mount without changing existing routes or raw URL navigation', async() => {
  const driver = memoryDriver({ url: 'https://routes.example/home' });
  const router = createRouter({ driver, routes: { '/home': { name: 'home' } } });
  await router.start(); await router.getInitialDispatch();
  const current = router.getCurrent();
  assert.throws(() => router.mount({ '/expected': { name: '/reserved' } }), /reserved for URL navigation/);
  assert.equal(router.hasRoute('/reserved'), false);
  assert.equal(router.hasRoute('home'), true);
  assert.equal(router.getCurrent(), current);
  assert.equal(current.signal.aborted, false);
  assert.equal(await router.navigate('/home?tab=details').finished, true);
  assert.equal(router.getCurrent().name, 'home');
  assert.equal(router.getCurrent().query.get('tab'), 'details');
});
