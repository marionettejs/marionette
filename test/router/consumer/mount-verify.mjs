import assert from 'node:assert/strict';
import { setImmediate as turn } from 'node:timers/promises';
import { Application } from 'marionette';
import { Router, memoryDriver } from '@mnjs/router';
import { mountCatalog } from './catalog.mjs';

export async function verifyMount() {
  const region = document.body.appendChild(document.createElement('main'));
  const frame = new Application();
  const router = frame.addChildApp('navigation', new Router({ driver: memoryDriver({ url: 'https://mount.example/catalog' }) }));
  const work = new Map();
  const signals = [];
  const catalog = mountCatalog({ frame, router, region, loadItem(id, { signal }) {
    signals.push(signal);
    if (work.has(id)) { return work.get(id).promise; }
    return Promise.resolve(`Item ${id}`);
  } });
  try {
    assert.equal(catalog.owner.isRunning(), false);
    assert.equal(router.url('catalog', { id: 'a/b' }), '/catalog/a%2Fb');
    await frame.start(); await router.start();
    assert.equal((await router.getInitialDispatch()).status, 'matched');
    assert.equal(region.textContent, 'Catalog');
    assert.deepEqual(router.getCurrent().meta, { area: 'catalog' });
    assert.equal(await router.navigate('catalog', { id: '42' }).finished, true);
    assert.equal(region.textContent, 'Item 42');
    catalog.owner.stop();
    assert.equal(router.hasRoute('catalog'), true);
    assert.equal(region.textContent, '');
    assert.equal(await router.refresh(), true);
    assert.equal(region.textContent, 'Item 42');

    const obsolete = Promise.withResolvers(); work.set('old', obsolete);
    const pending = router.navigate('catalog', { id: 'old' });
    await pending.committed;
    await router.navigate('catalog', { id: 'new' }).finished;
    assert.equal(await pending.finished, false);
    obsolete.resolve('stale'); await turn();
    assert.equal(region.textContent, 'Item new');

    const retired = Promise.withResolvers(); work.set('retired', retired);
    const retiring = router.navigate('catalog', { id: 'retired' });
    await retiring.committed;
    catalog.owner.destroy();
    assert.equal(await retiring.finished, false);
    assert.equal(signals.at(-1).aborted, true);
    assert.equal(router.hasRoute('catalog'), false);
    assert.equal(region.textContent, '');
    retired.reject(new Error('retired request')); await turn();
    console.log('Installed native mount example: ordinary ownership, local routeTo, metadata, retained registration and stale/destroyed work passed.');
  } finally {
    frame.destroy();
    region.remove();
  }
}
