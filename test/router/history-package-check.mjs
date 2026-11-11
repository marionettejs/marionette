import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

export async function verifyHistoryPackage(consumer) {
  const require = createRequire(resolve(consumer, 'package.json'));
  const manifest = require('@mnjs/router/package.json');
  const esm = await import(pathToFileURL(resolve(consumer, 'node_modules/@mnjs/router', manifest.exports['.'].import.default)));
  for (const [format, api] of [['ESM', esm], ['CJS', require('@mnjs/router')]]) {
    const dom = new JSDOM('', { url: 'https://installed-history.example/' });
    const driver = api.historyDriver({ window: dom.window });
    const router = new api.Router({ driver, routes: { home: { path: '/' }, item: { path: '/items/:id' } } });
    try {
      await router.start();
      assert.equal((await router.getInitialDispatch()).status, 'matched');
      await router.navigate('item', { id: 7 }).finished;
      assert.equal(dom.window.location.pathname, '/items/7');
      router.updateState({ tab: 'details' });
      assert.deepEqual(router.getCurrent().state, { tab: 'details' });
      assert.equal(await router.back(), true);
      assert.equal(router.getCurrent().name, 'home');
      assert.equal(driver.capabilities.cancelTraverse, false);
      const future = driver.entries().at(-1);
      await driver.traverseTo(future.key).finished;
      assert.equal(router.getCurrent().params.id, '7');
      router.stop();
      dom.window.history.replaceState({ retained: true }, '', '/');
      await router.start();
      assert.equal((await router.getInitialDispatch()).status, 'matched');
      assert.deepEqual(router.getCurrent().state, { retained: true });
      assert.equal(driver.entries().length, 1);
    } finally { router.destroy(); dom.window.close(); }
    console.log(`${format} installed History driver: real Window history, state, Back/Forward, retained lifecycle passed.`);
  }
  const blocks = [...readFileSync(resolve(consumer, 'node_modules/@mnjs/router/readme.md'), 'utf8').matchAll(/```js\n([\s\S]*?)\n```/g)];
  const entry = resolve(consumer, 'history-readme.mjs');
  writeFileSync(entry, `${blocks[2][1]}\nexport { router };\n`);
  const dom = new JSDOM('', { url: 'https://installed-history.example/' });
  const previous = new Map(['window', 'navigation', 'URLPattern'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window });
  Object.defineProperty(globalThis, 'URLPattern', { configurable: true, writable: true, value: undefined });
  Object.defineProperty(globalThis, 'navigation', { configurable: true, get() { throw new Error('History README must not access native Navigation'); } });
  let router;
  try {
    ({ router } = await import(pathToFileURL(entry)));
    assert.equal(typeof globalThis.URLPattern, 'function');
    await router.start();
    assert.equal((await router.getInitialDispatch()).status, 'matched');
    assert.equal(router.getCurrent().name, 'home');
    console.log('Installed README History recipe: actual polyfill before construction, no native Navigation access, initial readiness passed.');
  } finally {
    router?.destroy(); dom.window.close();
    for (const [name, descriptor] of previous) {
      if (descriptor) { Object.defineProperty(globalThis, name, descriptor); } else { delete globalThis[name]; }
    }
  }
}
