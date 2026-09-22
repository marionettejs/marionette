import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

async function extract(page, id) {
  const markdown = await readFile(new URL(`../../../docs/${page}`, import.meta.url), 'utf8');
  const marker = `<!-- executable-example: ${id} -->`;
  assert.equal(markdown.split(marker).length - 1, 1, `expected one ${marker}`);
  const code = markdown.slice(markdown.indexOf(marker) + marker.length)
    .match(/^\s*```javascript\n([\s\S]*?)\n```/);
  assert.ok(code);
  await mkdir(new URL('./dist/', import.meta.url), { recursive: true });
  const output = new URL(`./dist/${id}.mjs`, import.meta.url);
  await writeFile(output, code[1]);
  return import(output);
}
const { createEditor } = await extract('application-effects.md', 'application-save-completion');
const { createWorkspace } = await extract('marionette.application.md', 'application-loading-shell');
const dom = new JSDOM('<!doctype html><div id="editor"></div><div id="workspace"></div>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const { Application, View } = await import('marionette');
const pending = [];
const navigated = [];
const editor = createEditor({
  el: document.querySelector('#editor'),
  saveRecord(value) {
    const request = { value, ...Promise.withResolvers() };
    pending.push(request);
    return request.promise;
  },
  navigate(value) { navigated.push(value); }
});
try {
  assert.equal(await editor.start(), true);
  const oldScreen = editor.getView();
  const oldSave = editor.save('old');
  assert.equal(await editor.restart(), true);
  pending[0].resolve('persisted old');
  assert.equal(await oldSave, false);
  assert.equal(oldScreen.isDestroyed(), true);
  assert.equal(editor.getView().el.textContent, 'Ready');
  assert.deepEqual(navigated, []);
  const first = editor.save('first');
  const second = editor.save('second');
  pending[2].resolve('second');
  assert.equal(await second, true);
  pending[1].resolve('first');
  assert.equal(await first, false);
  assert.deepEqual(navigated, ['second']);
  const replaced = editor.save('replaced');
  editor.getRegion().show(new View({ template: () => 'Replacement' }));
  pending[3].resolve('replaced');
  assert.equal(await replaced, false);
  assert.equal(document.querySelector('#editor').textContent, 'Replacement');
  await editor.restart();
  const failed = editor.save('failure');
  pending[4].reject(new Error('Server failure'));
  assert.equal(await failed, false);
  assert.equal(editor.getView().el.textContent, 'Could not save');
  const late = editor.save('late failure');
  await editor.stop();
  pending[5].reject(new Error('Late server failure'));
  assert.equal(await late, false);
  assert.deepEqual(navigated, ['second']);
} finally { await editor.destroy(); }

const account = Promise.withResolvers();
const settings = Promise.withResolvers();
const childReady = Promise.withResolvers();
const childEntered = Promise.withResolvers();
const startedLoaders = [];
let inputs;
const Child = Application.extend({
  prepareStart(options) {
    inputs = options;
    childEntered.resolve();
    return childReady.promise;
  },
  onStart() { this.showView(new View({ template: () => 'Content' })); }
});
const child = new Child();
let fail = false;
const workspace = createWorkspace({
  el: document.querySelector('#workspace'), child,
  loadAccount() { startedLoaders.push('account'); return fail ? Promise.reject(new Error('Offline')) : account.promise; },
  loadSettings() { startedLoaders.push('settings'); return settings.promise; }
});
try {
  const starting = workspace.start();
  assert.equal(document.querySelector('#workspace [role="status"]').textContent, 'Loading…');
  assert.deepEqual(startedLoaders, ['account', 'settings']);
  account.resolve({ name: 'Taylor' });
  await Promise.resolve();
  assert.equal(child.isRunning(), false);
  assert.equal(inputs, undefined, 'wait for both loaders before child startup');
  settings.resolve({ theme: 'light' });
  await childEntered.promise;
  assert.equal(workspace.isRunning(), false, 'parent awaits required child');
  assert.deepEqual(inputs.account, { name: 'Taylor' });
  assert.deepEqual(inputs.settings, { theme: 'light' });
  assert.equal(inputs.region, workspace.getView().getRegion('content'));
  assert.equal(workspace.getView().el.querySelector('main').isConnected, true);
  childReady.resolve();
  assert.equal(await starting, true);
  assert.equal(document.querySelector('#workspace').textContent, 'ReadyContent');
  const oldRegion = child.getRegion();
  assert.equal(await workspace.restart(), true);
  assert.notEqual(child.getRegion(), oldRegion);
  fail = true;
  await workspace.stop();
  await assert.rejects(workspace.start(), /Offline/);
  assert.equal(workspace.isRunning(), false);
  assert.equal(document.querySelector('#workspace').textContent, 'Could not load. Try again.');
  fail = false;
  assert.equal(await workspace.start(), true);
  assert.equal(document.querySelector('#workspace').textContent, 'ReadyContent');
} finally {
  childReady.resolve();
  await workspace.destroy();
  assert.equal(child.isDestroyed(), true);
  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
}
console.log('Exact completion and loading-shell snippets passed: replacement, restart, overlap, rejection, concurrent readiness, child startup, retry and teardown.');
