import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

// Run in this isolated Node test file. Browser tests separately establish focus.
test('editable survivors, latest selection and cleanup use installed package APIs', async() => {
  const dom = new JSDOM('<main></main>');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  let workspace;
  try {
    const { createWorkspace } = await import('./workspace.ts');
    const requests = [];
    workspace = createWorkspace({
      el: document.querySelector('main'),
      loadNote(id, { signal }) {
        const request = { id, signal, ...Promise.withResolvers() };
        requests.push(request);
        return request.promise; // Deliberately ignores abort.
      }
    });
    const editedModel = workspace.notes.at(0);
    const savedTitle = editedModel.get('title');
    const input = document.querySelector('input');
    input.value = 'Unsaved draft';
    workspace.notes.move(workspace.notes.at(0), 1);
    assert.equal(document.querySelectorAll('input')[1], input);
    assert.equal(input.value, 'Unsaved draft');
    const slow = workspace.navigate('slow');
    const fast = workspace.navigate('fast');
    assert.equal(requests[0].signal.aborted, true);
    requests[1].resolve({ title: 'Fast', body: '<literal>' });
    assert.equal(await fast, true);
    requests[0].resolve({ title: 'Stale', body: 'Wrong' });
    assert.equal(await slow, false);
    assert.equal(document.querySelector('h2').textContent, 'Fast');
    assert.equal(document.querySelector('section p').textContent, '<literal>');
    const failed = workspace.navigate('failed');
    requests[2].reject(new Error('offline'));
    await assert.rejects(failed, /offline/);
    assert.equal(document.querySelector('[role="status"]').textContent, 'Could not load this note. Try again.');
    assert.equal(document.querySelector('h2').textContent, 'Fast');
    const late = workspace.navigate('late');
    const oldButton = input.closest('li').querySelector('button');
    workspace.destroy();
    workspace.destroy();
    assert.equal(requests[3].signal.aborted, true);
    requests[3].resolve({ title: 'Too late', body: '' });
    assert.equal(await late, false);
    oldButton.click();
    assert.equal(editedModel.get('title'), savedTitle);
    workspace.notes.remove(workspace.notes.at(0));
    assert.equal(requests.length, 4);
    assert.equal(document.querySelector('main').children.length, 0);
  } finally {
    workspace?.destroy();
    dom.window.close();
    delete globalThis.window;
    delete globalThis.document;
  }
});

test('missing attributes render empty text and supplied text stays escaped', async() => {
  const dom = new JSDOM('<main></main>');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  let workspace;
  try {
    const { createWorkspace } = await import('./workspace.ts');
    const { Model } = await import('@mnjs/data');
    const literal = '\"><img src=x onerror="alert(1)">&';
    workspace = createWorkspace({
      el: document.querySelector('main'),
      async loadNote(id) {
        return id === 'missing' ? { title: null } : { title: literal, body: literal };
      }
    });
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
    workspace?.destroy();
    dom.window.close();
    delete globalThis.window;
    delete globalThis.document;
  }
});
