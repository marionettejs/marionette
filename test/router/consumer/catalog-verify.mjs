import assert from 'node:assert/strict';
import { setImmediate as turn } from 'node:timers/promises';
import { Application } from 'marionette';
import { Router, memoryDriver } from '@mnjs/router';
import { Catalog } from './catalog.mjs';

export async function verifyCatalog() {
  const region = document.body.appendChild(document.createElement('main'));
  const frame = new Application();
  const router = frame.addChildApp('navigation', new Router({ driver: memoryDriver({ url: 'https://mount.example/catalog' }) }));
  const work = new Map();
  const signals = [];
  const markup = '<img src=x onerror="globalThis.exampleInjected=true"><b>untrusted & text</b>';
  const catalog = frame.addChildApp('catalog', new Catalog({
    region: { el: region },
    loadItem(id, { signal }) {
      signals.push(signal);
      if (work.has(id)) { return work.get(id).promise; }
      return Promise.resolve(id === 'markup' ? markup : `Item ${id}`);
    },
  }));
  catalog.mountRoutes(router);
  try {
    assert.equal(catalog.isRunning(), false);
    assert.equal(router.url('catalog:item', { id: 'a/b' }), '/catalog/a%2Fb');
    await frame.start(); await catalog.start(); await router.start();
    assert.equal((await router.getInitialDispatch()).status, 'matched');
    assert.ok(region.querySelector('h1'), 'CatalogView must render its template through the Region');
    assert.equal(region.textContent, 'Catalog');
    assert.deepEqual(router.getCurrent().meta, { area: 'catalog' });
    assert.equal(await router.navigate('catalog:item', { id: '42' }).finished, true);
    assert.equal(region.textContent, 'Item 42');
    const replaced = catalog.getChildApp('item').getView();
    assert.equal(await router.navigate('catalog:item', { id: 'markup' }).finished, true);
    assert.equal(region.querySelector('h1').textContent, markup, 'Fetched titles must remain text');
    assert.equal(region.querySelector('img, b'), null, 'Fetched titles must not become HTML');
    assert.equal(replaced.isDestroyed(), true, 'Showing a replacement destroys the old View');
    await router.navigate('catalog:item', { id: '42' }).finished;
    const item = catalog.getChildApp('item');
    const stopping = item.getView();
    catalog.stop();
    assert.equal(stopping.isDestroyed(), true);
    assert.equal(router.hasRoute('catalog'), true);
    assert.equal(region.textContent, '');
    await catalog.start();
    assert.equal(await router.refresh(), true);
    assert.equal(region.textContent, 'Item 42');
    const beforeRepeat = signals.length;
    await router.navigate('catalog:reviews').finished;
    assert.equal(region.textContent, 'Reviews: Item 42');
    await router.navigate('catalog:item', { id: '42' }).finished;
    await router.navigate('catalog:item', { id: '42' }).finished;
    assert.equal(signals.length, beforeRepeat, 'Repeated IDs and refresh retain the selected preparation');

    const obsolete = Promise.withResolvers(); work.set('old', obsolete);
    const pending = router.navigate('catalog:item', { id: 'old' });
    await pending.committed;
    await router.navigate('catalog:item', { id: 'new' }).finished;
    assert.equal(await pending.finished, false);
    obsolete.resolve('stale'); await turn();
    assert.equal(region.textContent, 'Item new');

    const away = Promise.withResolvers(); work.set('away', away);
    router.mount({ '/outside': { name: 'outside', handler() { catalog.clear(); } } });
    const departing = router.navigate('catalog:item', { id: 'away' });
    await departing.committed;
    await router.navigate('outside').finished;
    assert.equal(await departing.finished, false);
    away.resolve('obsolete after leaving'); await turn();
    assert.equal(region.textContent, '', 'Leaving the feature must not attach stale preparation');
    assert.equal(item.isRunning(), false);

    const retired = Promise.withResolvers(); work.set('retired', retired);
    const retiring = router.navigate('catalog:item', { id: 'retired' });
    await retiring.committed;
    catalog.destroy();
    assert.equal(await retiring.finished, false);
    assert.equal(signals.at(-1).aborted, true);
    assert.equal(router.hasRoute('catalog'), false);
    assert.equal(region.textContent, '');
    retired.reject(new Error('retired request')); await turn();
    console.log('Installed Catalog example: rendered/escaped templates, View replacement, mounted lifecycle retention, explicit ownership and stale/destroyed work passed.');
  } finally {
    frame.destroy();
    region.remove();
  }
}
