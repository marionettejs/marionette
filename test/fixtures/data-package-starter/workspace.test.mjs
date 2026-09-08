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
    const { createWorkspace } = await import('./workspace.mjs');
    const requests = [];
    workspace = createWorkspace({
      el: document.querySelector('main'),
      loadNote(id, { signal }) {
        const request = { id, signal, ...Promise.withResolvers() };
        requests.push(request);
        return request.promise; // Deliberately ignores abort.
      }
    });
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
    assert.equal(document.querySelector('h2').textContent, 'Fast');
    const late = workspace.navigate('late');
    const oldButton = input.closest('li').querySelector('button');
    workspace.destroy();
    workspace.destroy();
    assert.equal(requests[3].signal.aborted, true);
    requests[3].resolve({ title: 'Too late', body: '' });
    assert.equal(await late, false);
    oldButton.click();
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
