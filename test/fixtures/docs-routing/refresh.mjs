import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { Application } from 'marionette';
import { Collection } from '@mnjs/data';
import { createLatestRequest } from './dist/latest-request.js';
import { createResultsFeature } from './dist/results-feature.js';

await test('documented refresh uses one active session and replaces only current data', async t => {
  const dom = new JSDOM('<!doctype html><main></main>');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  async function fixture(beforeStop) {
    const items = new Collection([{ id: 1, name: 'First' }]);
    const requests = [];
    const feature = await createResultsFeature({
      el: document.querySelector('main'), items, beforeStop,
      loadItems(query, { signal }) {
        const request = { query, signal, ...Promise.withResolvers() };
        requests.push(request);
        return request.promise;
      }
    });
    return { ...feature, items, requests, async destroy() {
      requests.forEach(request => request.resolve([]));
      await feature.application.destroy();
      items.destroy();
    } };
  }

  try {
    await t.test('refresh retains layout, editor, collection, model, and surviving row identities', async() => {
      const f = await fixture();
      try {
        const layout = f.application.getView();
        const row = document.querySelector('li');
        const editor = document.querySelector('textarea');
        const model = f.items.get(1);
        editor.value = 'Unsaved draft';
        const slow = f.refresh('slow');
        const fast = f.refresh('fast');
        assert.equal(f.requests[0].signal.aborted, true);
        assert.equal(document.querySelector('li'), row);
        f.requests[1].resolve([{ id: 1, name: '<b>Updated</b>' }, { id: 2, name: 'Second' }]);
        assert.equal(await fast, true);
        f.requests[0].resolve([{ id: 3, name: 'Stale' }]);
        assert.equal(await slow, false);
        assert.equal(f.application.getView(), layout);
        assert.equal(f.items.get(1), model);
        assert.equal(document.querySelector('li'), row);
        assert.equal(row.textContent, '<b>Updated</b>');
        assert.equal(row.querySelector('b'), null);
        assert.equal(document.querySelector('textarea'), editor);
        assert.equal(editor.value, 'Unsaved draft');
        assert.equal(f.application.isRunning(), true);
        const secondRow = document.querySelectorAll('li')[1];
        const reordered = f.refresh('reordered');
        f.requests[2].resolve([{ id: 2, name: 'Second' }, { id: 1, name: 'Moved' }]);
        assert.equal(await reordered, true);
        assert.deepEqual([...document.querySelectorAll('li')], [secondRow, row]);
        const removed = f.refresh('removed');
        f.requests[3].resolve([{ id: 1, name: 'Survivor' }]);
        assert.equal(await removed, true);
        assert.equal(secondRow.isConnected, false);
        assert.equal(document.querySelector('li'), row);
        assert.equal(f.items.get(1), model);
      } finally { await f.destroy(); }
    });

    await t.test('old errors and finally cannot overwrite data or release a newer cancellation handle', async() => {
      const f = await fixture();
      try {
        const old = f.refresh('old');
        const middle = f.refresh('middle');
        f.requests[0].reject(new Error('Obsolete failure'));
        assert.equal(await old, false);
        const newest = f.refresh('newest');
        assert.equal(f.requests[1].signal.aborted, true);
        f.requests[1].resolve([{ id: 2, name: 'Middle' }]);
        f.requests[2].resolve([{ id: 1, name: 'Newest' }]);
        assert.equal(await middle, false);
        assert.equal(await newest, true);
        assert.equal(document.querySelector('li').textContent, 'Newest');
      } finally { await f.destroy(); }
    });

    await t.test('current load failures reject, preserve displayed data, and permit retry', async() => {
      const f = await fixture();
      try {
        const failed = f.refresh('failed');
        const error = new Error('Try again');
        f.requests[0].reject(error);
        await assert.rejects(failed, failure => failure === error);
        assert.equal(document.querySelector('li').textContent, 'First');
        const retry = f.refresh('retry');
        f.requests[1].resolve([{ id: 1, name: 'Recovered' }]);
        assert.equal(await retry, true);
        assert.equal(document.querySelector('li').textContent, 'Recovered');
      } finally { await f.destroy(); }
    });

    await t.test('feature cancellation retains display and permits a new refresh', async() => {
      const f = await fixture();
      try {
        const row = document.querySelector('li');
        const canceled = f.refresh('canceled');
        f.cancel();
        assert.equal(f.requests[0].signal.aborted, true);
        f.requests[0].resolve([{ id: 1, name: 'Canceled' }]);
        assert.equal(await canceled, false);
        assert.equal(document.querySelector('li'), row);
        assert.equal(row.textContent, 'First');
        const retry = f.refresh('retry');
        f.requests[1].resolve([{ id: 1, name: 'Retried' }]);
        assert.equal(await retry, true);
        assert.equal(row.textContent, 'Retried');
      } finally { await f.destroy(); }
    });

    await t.test('independent controllers do not cancel each other', async() => {
      const loads = [];
      const commits = [];
      const makeController = () => createLatestRequest({
        load(input, { signal }) {
          const request = { signal, ...Promise.withResolvers() };
          loads.push(request);
          return request.promise;
        },
        commit: value => commits.push(value)
      });
      const list = makeController();
      const detail = makeController();
      try {
        const listRequest = list.run('list');
        const detailRequest = detail.run('detail');
        list.dispose();
        assert.equal(loads[0].signal.aborted, true);
        assert.equal(loads[1].signal.aborted, false);
        loads[0].resolve('list');
        loads[1].resolve('detail');
        assert.equal(await listRequest, false);
        assert.equal(await detailRequest, true);
        assert.deepEqual(commits, ['detail']);
      } finally { list.dispose(); detail.dispose(); loads.forEach(load => load.resolve()); }
    });

    await t.test('stop permission keeps requests active until successful deactivation', async() => {
      const permission = Promise.withResolvers();
      let hold = true;
      const f = await fixture(() => hold ? permission.promise : undefined);
      try {
        const loading = f.refresh('during-permission');
        const stopping = f.application.stop().then(value => ({ value }), error => ({ error }));
        f.requests[0].resolve([{ id: 1, name: 'Still active' }]);
        assert.equal(await loading, true);
        assert.equal(document.querySelector('li').textContent, 'Still active');
        const denied = new Error('Keep editing');
        permission.reject(denied);
        assert.equal((await stopping).error, denied);
        assert.equal(f.application.isRunning(), true);
        const pending = f.refresh('before-stop');
        hold = false;
        assert.equal(await f.application.stop(), true);
        assert.equal(f.requests[1].signal.aborted, true);
        assert.equal(await f.refresh('stopped'), false);
        assert.equal(f.requests.length, 2);
        assert.equal(await f.application.start(), true);
        const resumed = f.refresh('resumed');
        f.requests[2].resolve([{ id: 1, name: 'New session' }]);
        assert.equal(await resumed, true);
        f.requests[1].resolve([{ id: 1, name: 'Obsolete session' }]);
        assert.equal(await pending, false);
        assert.equal(f.items.get(1).get('name'), 'New session');
      } finally { hold = false; permission.resolve(); await f.destroy(); }
    });

    await t.test('start superseding pending stop releases the previous request controller', async() => {
      const permission = Promise.withResolvers();
      const f = await fixture(() => permission.promise);
      try {
        const old = f.refresh('old-session');
        const stopping = f.application.stop();
        const starting = f.application.start();
        assert.equal(await stopping, false);
        permission.resolve();
        assert.equal(await starting, true);
        assert.equal(f.requests[0].signal.aborted, true);
        const current = f.refresh('current-session');
        f.requests[1].resolve([{ id: 1, name: 'Current session' }]);
        assert.equal(await current, true);
        f.requests[0].resolve([{ id: 1, name: 'Obsolete session' }]);
        assert.equal(await old, false);
        assert.equal(document.querySelector('li').textContent, 'Current session');
      } finally { permission.resolve(); await f.destroy(); }
    });

    await t.test('owner stop and direct destroy cancel work without disposing borrowed data', async() => {
      const f = await fixture();
      const owner = new Application();
      owner.addChildApp('results', f.application);
      try {
        const pending = f.refresh('owned');
        await owner.stop();
        assert.equal(f.requests[0].signal.aborted, true);
        f.requests[0].resolve([{ id: 1, name: 'Too late' }]);
        assert.equal(await pending, false);
        assert.equal(document.querySelector('main').children.length, 0);
        await f.application.start();
        const destroyed = f.refresh('destroyed');
        await f.application.destroy();
        assert.equal(f.requests[1].signal.aborted, true);
        f.requests[1].reject(new Error('Late failure'));
        assert.equal(await destroyed, false);
        assert.equal(await f.refresh('after-destroy'), false);
        assert.equal(f.items.get(1).get('name'), 'First');
        f.items.get(1).set({ name: 'Borrower remains live' });
        assert.equal(f.items.get(1).get('name'), 'Borrower remains live');
      } finally { await owner.destroy(); await f.destroy(); }
    });

    await t.test('cancellation releases external listeners before a non-cooperative loader settles', async() => {
      const external = new AbortController();
      const listeners = new Set();
      const signal = external.signal;
      const add = signal.addEventListener.bind(signal);
      const remove = signal.removeEventListener.bind(signal);
      signal.addEventListener = (name, callback, options) => { listeners.add(callback); add(name, callback, options); };
      signal.removeEventListener = (name, callback) => { listeners.delete(callback); remove(name, callback); };
      const loads = [];
      const commits = [];
      const requests = createLatestRequest({ load(input, context) {
        const load = { ...context, ...Promise.withResolvers() };
        loads.push(load);
        return load.promise;
      }, commit: value => commits.push(value) });
      try {
        const first = requests.run('first', { signal });
        assert.equal(listeners.size, 1);
        const aborted = new AbortController();
        aborted.abort();
        assert.equal(await requests.run('ignored', { signal: aborted.signal }), false);
        assert.equal(loads[0].signal.aborted, false);
        const second = requests.run('second');
        assert.equal(listeners.size, 0);
        assert.equal(loads[0].signal.aborted, true);
        requests.cancel();
        loads[0].resolve('old');
        loads[1].resolve('canceled');
        assert.equal(await first, false);
        assert.equal(await second, false);
        assert.deepEqual(commits, []);
        const third = requests.run('third', { signal });
        external.abort();
        assert.equal(listeners.size, 0);
        loads[2].resolve('externally canceled');
        assert.equal(await third, false);
        requests.dispose();
        requests.dispose();
        assert.equal(await requests.run('disposed'), false);
        assert.equal(loads.length, 3);
      } finally { requests.dispose(); loads.forEach(load => load.resolve()); }
    });

    await t.test('current synchronous commit failures reject without a recovery contract', async() => {
      const error = new Error('Commit failed');
      const requests = createLatestRequest({ load: async() => 'value', commit() { throw error; } });
      try { await assert.rejects(requests.run('input'), failure => failure === error); } finally { requests.dispose(); }
    });
  } finally {
    dom.window.close();
    delete globalThis.window;
    delete globalThis.document;
  }
});
