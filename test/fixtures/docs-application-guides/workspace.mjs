import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const markdown = await readFile(new URL('../../../docs/task-recipes.md', import.meta.url), 'utf8');
const code = markdown.match(/<!-- executable-example: widget-owned-workspace -->\n```javascript\n([\s\S]*?)\n```/);
assert.ok(code);
const example = new URL('./dist/workspace.mjs', import.meta.url);
await writeFile(example, code[1]);
const { createEditorWorkspace } = await import(example);

await test('documented editor workspace preserves siblings and owns external handles', t => {
  const dom = new JSDOM('<!doctype html><main></main>');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  const handles = [];
  const saves = [];
  const host = document.querySelector('main');
  const workspace = createEditorWorkspace(host, (element, emit) => {
    assert.equal(element.isConnected, true);
    const handle = { element, emit, destroyed: 0, destroy() {
      this.destroyed++;
      emit('callback during teardown');
    } };
    handles.push(handle);
    return handle;
  }, (...args) => saves.push(args));
  t.after(() => {
    workspace.destroy();
    dom.window.close();
    delete globalThis.window;
    delete globalThis.document;
  });

  const notesView = workspace.view.getChildView('notes');
  const notes = host.querySelector('textarea');
  notes.value = 'Unfinished notes';
  notes.focus();
  const first = workspace.openEditor('first', '<b>First</b>');
  assert.equal(host.querySelector('[data-editor-region]'), null);
  assert.equal(first.el.querySelector('[data-label]').textContent, '<b>First</b>');
  assert.equal(first.el.querySelector('b'), null);
  handles[0].emit('first draft');
  const retainedButton = first.el.querySelector('button');
  retainedButton.click();
  assert.deepEqual(saves, [['first', 'first draft']]);

  const second = workspace.openEditor('second', 'Second');
  assert.equal(first.isDestroyed(), true);
  assert.equal(handles[0].destroyed, 1);
  assert.equal(workspace.view.getChildView('notes'), notesView);
  assert.equal(host.querySelector('textarea'), notes);
  assert.equal(notes.value, 'Unfinished notes');
  assert.equal(document.activeElement, notes);
  first.triggerMethod('save', 'first', 'stale');
  retainedButton.click();
  handles[0].emit('late');
  second.el.querySelector('button').click();
  assert.deepEqual(saves.at(-1), ['second', '']);
  assert.equal(saves.length, 2);

  handles[1].emit('second draft');
  const region = workspace.view.getRegion('editor');
  assert.equal(region.detachView(), second);
  assert.equal(handles[1].destroyed, 1);
  assert.equal(second.isDestroyed(), false);
  handles[1].emit('late while detached');
  region.show(second);
  assert.equal(handles.length, 3);
  handles[1].emit('late after reattachment');
  second.el.querySelector('button').click();
  assert.deepEqual(saves.at(-1), ['second', 'second draft']);
  handles[2].emit('new handle draft');
  second.render();
  assert.equal(handles[2].destroyed, 1);
  assert.equal(handles.length, 4);
  handles[2].emit('late after rerender');
  second.el.querySelector('button').click();
  assert.deepEqual(saves.at(-1), ['second', 'new handle draft']);

  workspace.closeEditor();
  assert.equal(second.isDestroyed(), true);
  assert.equal(handles[3].destroyed, 1);
  second.triggerMethod('save', 'second', 'stale');
  assert.equal(saves.length, 4);
  assert.equal(host.querySelector('textarea'), notes);
  assert.equal(notesView.isDestroyed(), false);
  const third = workspace.openEditor('third', 'Third');
  handles[4].emit('third draft');
  third.el.querySelector('button').click();
  assert.deepEqual(saves.at(-1), ['third', 'third draft']);
  workspace.destroy();
  workspace.destroy();
  third.triggerMethod('save', 'third', 'stale');
  handles[4].emit('late after destruction');
  assert.equal(saves.length, 5);
  assert.equal(notesView.isDestroyed(), true);
  assert.equal(third.isDestroyed(), true);
  assert.deepEqual(handles.map(handle => handle.destroyed), [1, 1, 1, 1, 1]);
});
