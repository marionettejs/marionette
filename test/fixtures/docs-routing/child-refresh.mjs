import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { WorkspaceResults } from './dist/workspace-results.js';

const dom = new JSDOM('<!doctype html><main id="workspace"></main>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const loads = new Map();
const workspace = new WorkspaceResults({
  region: { el: document.querySelector('#workspace') },
  loadItems(query, { signal }) {
    const load = { signal, ...Promise.withResolvers() };
    loads.set(query, load);
    return load.promise;
  }
});

const listOwner = workspace.getChildApp('list');
const sidebarOwner = workspace.getChildApp('sidebar');
try {
  assert.equal(await workspace.start(), true);
  assert.equal(workspace.getChildApp('list'), listOwner);
  assert.equal(workspace.getChildApp('sidebar'), sidebarOwner);
  assert.equal(workspace.getChildApp('list').isRunning(), true);
  assert.equal(workspace.getChildApp('sidebar').isRunning(), true);
  const shell = workspace.getView();
  const sidebar = workspace.getChildApp('sidebar').getView();
  const input = document.querySelector('aside input');
  const draft = document.querySelector('aside textarea');
  input.checked = true;
  draft.value = 'Keep this draft';

  const initial = workspace.refresh('initial');
  loads.get('initial').resolve([{ id: 1, name: 'First' }]);
  assert.equal(await initial, true);
  const firstCard = document.querySelector('li');
  const firstModel = listOwner.items.get(1);

  const slow = workspace.refresh('slow');
  assert.equal(firstCard.textContent, 'First', 'loading keeps current cards');
  const fast = workspace.refresh('fast');
  assert.equal(loads.get('slow').signal.aborted, true);
  loads.get('fast').resolve([{ id: 1, name: '<b>Updated</b>' }, { id: 2, name: 'Second' }]);
  assert.equal(await fast, true);
  loads.get('slow').resolve([{ id: 3, name: 'Stale' }]);
  assert.equal(await slow, false);
  assert.equal(workspace.getView(), shell);
  assert.equal(workspace.getChildApp('sidebar').getView(), sidebar);
  assert.equal(document.querySelector('aside input'), input);
  assert.equal(document.querySelector('aside textarea'), draft);
  assert.equal(input.checked, true);
  assert.equal(draft.value, 'Keep this draft');
  assert.equal(listOwner.items.get(1), firstModel);
  assert.equal(document.querySelector('li'), firstCard);
  assert.equal(firstCard.textContent, '<b>Updated</b>');
  assert.equal(firstCard.querySelector('b'), null);
  assert.equal(document.querySelector('[role="status"]').textContent, 'Ready');

  const oldFailure = workspace.refresh('old-failure');
  const latest = workspace.refresh('latest');
  loads.get('latest').resolve([{ id: 2, name: 'Second' }, { id: 1, name: 'Latest' }]);
  assert.equal(await latest, true);
  loads.get('old-failure').reject(new Error('Obsolete failure'));
  assert.equal(await oldFailure, false);
  assert.equal(document.querySelector('[role="status"]').textContent, 'Ready');
  assert.equal(document.querySelectorAll('li')[1], firstCard);

  const currentFailure = workspace.refresh('current-failure');
  loads.get('current-failure').reject(new Error('Current failure'));
  assert.equal(await currentFailure, false);
  assert.equal(document.querySelector('[role="status"]').textContent, 'Could not load. Try again.');
  assert.equal(firstCard.textContent, 'Latest');
  const retry = workspace.refresh('retry');
  loads.get('retry').resolve([{ id: 1, name: 'Retried' }]);
  assert.equal(await retry, true);
  assert.equal(document.querySelector('li'), firstCard);
  assert.equal(input.checked, true);
  assert.equal(draft.value, 'Keep this draft');

  const canceled = workspace.refresh('canceled');
  workspace.cancelRefresh();
  assert.equal(loads.get('canceled').signal.aborted, true);
  assert.equal(document.querySelector('[role="status"]').textContent, 'Ready');
  loads.get('canceled').reject(new Error('Canceled failure'));
  assert.equal(await canceled, false);
  assert.equal(document.querySelector('[role="status"]').textContent, 'Ready');
  assert.equal(firstCard.textContent, 'Retried');
  assert.equal(input.checked, true);
  assert.equal(draft.value, 'Keep this draft');

  const pendingStop = workspace.refresh('pending-stop');
  assert.equal(await workspace.stop(), true);
  assert.equal(loads.get('pending-stop').signal.aborted, true);
  loads.get('pending-stop').resolve([{ id: 4, name: 'Too late' }]);
  assert.equal(await pendingStop, false);
  assert.equal(shell.isDestroyed(), true);
  assert.equal(sidebar.isDestroyed(), true);
  assert.equal(await workspace.refresh('while-stopped'), false);
  assert.equal(loads.has('while-stopped'), false);

  assert.equal(await workspace.start(), true);
  assert.notEqual(workspace.getView(), shell);
  assert.equal(workspace.getChildApp('list').isRunning(), true);
  assert.equal(workspace.getChildApp('sidebar').isRunning(), true);
  const newInput = document.querySelector('aside input');
  assert.notEqual(newInput, input, 'restart of active lifetime replaces sidebar UI');
  assert.notEqual(document.querySelector('aside textarea'), draft);
  const pendingDestroy = workspace.refresh('pending-destroy');
  assert.equal(await workspace.destroy(), true);
  assert.equal(loads.get('pending-destroy').signal.aborted, true);
  loads.get('pending-destroy').reject(new Error('Late failure'));
  assert.equal(await pendingDestroy, false);
  assert.equal(listOwner.isDestroyed(), true);
  assert.equal(sidebarOwner.isDestroyed(), true);
  assert.equal(document.querySelector('#workspace').children.length, 0);
  console.log('Child refresh example passed: independent ownership, retained cards/sidebar, stale effects, retry, stop and destroy.');
} finally {
  loads.forEach(load => load.resolve([]));
  if (!workspace.isDestroyed()) { await workspace.destroy(); }
  assert.equal(listOwner.items.isDestroyed(), true);
  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
}
