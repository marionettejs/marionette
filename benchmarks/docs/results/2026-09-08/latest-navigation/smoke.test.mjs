import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

test('latest request wins, safe text, load failures, and owned cleanup', async (t) => {
  const dom = new JSDOM('<main id="page"></main>');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  t.after(() => {
    dom.window.close();
    delete globalThis.window;
    delete globalThis.document;
  });
  const { Region } = await import('marionette');
  const { createNavigation } = await import('./solution.mjs');
  const shown = [];
  const show = Region.prototype.show;
  t.mock.method(Region.prototype, 'show', function (view, options) {
    const result = show.call(this, view, options);
    shown.push(view);
    return result;
  });
  const requests = [];
  const el = document.querySelector('#page');
  const navigation = createNavigation({
    el,
    loadRecord(id, { signal }) {
      return new Promise((resolve, reject) => requests.push({ id, signal, resolve, reject }));
    },
  });
  const first = navigation.navigate('first');
  const unsafe = '<img src=x onerror="alert(1)"> & text';
  requests[0].resolve({ title: unsafe });
  assert.equal(await first, true);
  assert.equal(el.querySelector('h1').textContent, unsafe);
  assert.equal(el.querySelector('img'), null);
  assert.equal(shown[0].isAttached(), true);

  const old = navigation.navigate('same');
  const latest = navigation.navigate('same');
  assert.equal(requests[1].signal.aborted, true);
  assert.equal(el.querySelector('h1').textContent, unsafe);
  requests[2].resolve({ title: 'Latest' });
  assert.equal(await latest, true);
  assert.equal(shown[0].isDestroyed(), true);
  requests[1].resolve({ title: 'Too late' });
  assert.equal(await old, false);
  assert.equal(el.querySelector('h1').textContent, 'Latest');

  const staleFailure = navigation.navigate('old-failure');
  const currentFailure = navigation.navigate('current-failure');
  requests[3].reject(new Error('stale'));
  assert.equal(await staleFailure, false);
  const error = new Error('current');
  requests[4].reject(error);
  await assert.rejects(currentFailure, (received) => received === error);
  assert.equal(el.querySelector('h1').textContent, 'Latest');

  const recovery = navigation.navigate('recovery');
  requests[5].resolve({ title: 'Recovered' });
  assert.equal(await recovery, true);
  assert.equal(shown[1].isDestroyed(), true);

  const lateSuccess = navigation.navigate('dispose-success');
  const lateFailure = navigation.navigate('dispose-failure');
  navigation.dispose();
  navigation.dispose();
  assert.equal(requests[6].signal.aborted, true);
  assert.equal(requests[7].signal.aborted, true);
  assert.equal(shown[2].isDestroyed(), true);
  assert.equal(el.isConnected, true);
  assert.equal(el.children.length, 0);
  requests[6].resolve({ title: 'After disposal' });
  requests[7].reject(new Error('After disposal'));
  assert.deepEqual(await Promise.all([lateSuccess, lateFailure]), [false, false]);
  assert.equal(await navigation.navigate('stopped'), false);
  assert.equal(requests.length, 8);
  assert.equal(el.children.length, 0);
});
