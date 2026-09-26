import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const settle = () => new Promise(resolve => setImmediate(resolve));

// Run in this isolated Node test file. Browser tests separately establish focus.
test('editable survivors, latest selection and cleanup use installed package APIs', async(t) => {
  const dom = new JSDOM('<main></main>');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  let workspace;
  try {
    const { Workspace } = await import('./workspace.ts');
    const { notesApi } = await import('./notes.ts');
    const requests = [];
    t.mock.method(notesApi, 'loadNote', (id, { signal }) => {
      const request = { id, signal, ...Promise.withResolvers() };
      requests.push(request);
      return request.promise; // Deliberately ignores abort.
    });
    workspace = new Workspace({ region: { el: document.querySelector('main') } });
    await workspace.start();
    const editedModel = workspace.notes.at(0);
    const savedTitle = editedModel.get('title');
    const input = document.querySelector('input');
    input.value = 'Unsaved draft';
    workspace.notes.move(workspace.notes.at(0), 1);
    assert.equal(document.querySelectorAll('input')[1], input);
    assert.equal(input.value, 'Unsaved draft');
    const slow = workspace.navigate('slow');
    await settle();
    const fast = workspace.navigate('fast');
    await settle();
    assert.equal(requests[0].signal.aborted, true);
    requests[1].resolve({ title: 'Fast', body: '<literal>' });
    assert.equal(await fast, true);
    requests[0].resolve({ title: 'Stale', body: 'Wrong' });
    assert.equal(await slow, false);
    assert.equal(document.querySelector('h2').textContent, 'Fast');
    assert.equal(document.querySelector('section p').textContent, '<literal>');
    const failed = workspace.navigate('failed');
    await settle();
    requests[2].reject(new Error('offline'));
    await assert.rejects(failed, /offline/);
    assert.equal(document.querySelector('[role="status"]').textContent, 'Could not load this note. Try again.');
    assert.equal(document.querySelector('h2'), null);
    const late = workspace.navigate('late');
    await settle();
    const oldButton = input.closest('li').querySelector('button');
    await workspace.destroy();
    await workspace.destroy();
    assert.equal(requests[3].signal.aborted, true);
    requests[3].resolve({ title: 'Too late', body: '' });
    assert.equal(await late, false);
    oldButton.click();
    assert.equal(editedModel.get('title'), savedTitle);
    workspace.notes.remove(workspace.notes.at(0));
    assert.equal(requests.length, 4);
    assert.equal(document.querySelector('main').children.length, 0);
  } finally {
    await workspace?.destroy();
    dom.window.close();
    delete globalThis.window;
    delete globalThis.document;
  }
});

test('missing attributes render empty text and supplied text stays escaped', async(t) => {
  const dom = new JSDOM('<main></main>');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  let workspace;
  try {
    const { Workspace } = await import('./workspace.ts');
    const { notesApi } = await import('./notes.ts');
    const { Model } = await import('@mnjs/data');
    const literal = '"><img src=x onerror="alert(1)">&';
    t.mock.method(notesApi, 'loadNote', async(id) => {
      return id === 'missing' ? { title: null } : { title: literal, body: literal };
    });
    workspace = new Workspace({ region: { el: document.querySelector('main') } });
    await workspace.start();
    workspace.notes.add(new Model({ id: 'missing' }));
    workspace.notes.add(new Model({ id: 'null', title: null }));
    workspace.notes.add(new Model({ id: 'escaped', title: literal }));
    assert.deepEqual([...document.querySelectorAll('input')].slice(2).map(input => input.value), ['', '', literal]);
    assert.equal(await workspace.navigate('missing'), true);
    assert.equal(document.querySelector('h2').textContent, '');
    assert.equal(document.querySelector('section p').textContent, '');
    assert.equal(document.querySelector('[role="status"]').textContent, 'Loaded.');
    assert.equal(await workspace.navigate('escaped'), true);
    assert.equal(document.querySelector('h2').textContent, literal);
    assert.equal(document.querySelector('section p').textContent, literal);
    assert.equal(document.querySelectorAll('img, [onerror]').length, 0);
  } finally {
    await workspace?.destroy();
    dom.window.close();
    delete globalThis.window;
    delete globalThis.document;
  }
});

test('a parent owns stop, restart and destruction; host replacement cancels late work', async(t) => {
  const dom = new JSDOM('<main></main>');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  let parent;
  try {
    const { Application, View } = await import('marionette');
    const { Workspace } = await import('./workspace.ts');
    const { notesApi } = await import('./notes.ts');
    const requests = [];
    t.mock.method(notesApi, 'loadNote', (id, { signal }) => {
      const request = { signal, ...Promise.withResolvers() };
      requests.push(request);
      return request.promise;
    });
    const workspace = new Workspace({ region: { el: document.querySelector('main') } });
    parent = new Application();
    parent.addChildApp('workspace', workspace);
    await parent.start();
    await workspace.start();
    const notes = workspace.notes;
    const pending = workspace.navigate('first');
    await settle();
    await parent.stop();
    assert.equal(requests[0].signal.aborted, true);
    requests[0].resolve({ title: 'Late', body: '' });
    assert.equal(await pending, false);
    assert.equal(notes.isDestroyed(), false);
    assert.equal(document.querySelector('main').children.length, 0);
    await parent.start();
    await workspace.start();
    assert.equal(workspace.notes, notes);
    const oldRoot = workspace.getView();
    const replaced = workspace.navigate('second');
    await settle();
    workspace.getRegion().show(new View({ template: () => 'Replacement' }));
    requests[1].reject(new Error('Late failure'));
    assert.equal(await replaced, false);
    assert.equal(oldRoot.isDestroyed(), true);
    assert.equal(await workspace.navigate('after-replacement'), false);
    assert.equal(document.querySelector('main').textContent, 'Replacement');
    await parent.destroy();
    assert.equal(workspace.isDestroyed(), true);
    assert.equal(notes.isDestroyed(), true);
  } finally {
    await parent?.destroy();
    dom.window.close();
    delete globalThis.window;
    delete globalThis.document;
  }
});

test('external title changes update clean rows and preserve dirty drafts until Open', async(t) => {
  const dom = new JSDOM('<main></main>');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  let workspace;
  try {
    const { Workspace } = await import('./workspace.ts');
    const { notesApi } = await import('./notes.ts');
    t.mock.method(notesApi, 'loadNote', async() => ({ title: 'Detail', body: '' }));
    workspace = new Workspace({ region: { el: document.querySelector('main') } });
    await workspace.start();
    const model = workspace.notes.at(0);
    const input = document.querySelector('input');
    model.set('title', 'External title');
    assert.equal(input.value, 'External title');
    input.value = 'Local draft';
    model.set('title', 'New baseline');
    assert.equal(input.value, 'Local draft');
    assert.equal(document.querySelector('input'), input);
    input.closest('li').querySelector('button').click();
    assert.equal(model.get('title'), 'Local draft');
    model.set('title', 'After commit');
    assert.equal(input.value, 'After commit');
  } finally {
    await workspace?.destroy();
    dom.window.close();
    delete globalThis.window;
    delete globalThis.document;
  }
});
