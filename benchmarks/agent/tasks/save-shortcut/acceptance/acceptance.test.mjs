import './environment.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { View } from 'marionette';
import * as solution from '../solution.mjs';
const host = () => {
  const el = document.createElement('main');
  document.body.append(el);
  return el;
};
test('shortcut is host scoped and released across rerender/destroy', () => {
  const calls = [];
  const editor = solution.createEditor(host(), value => calls.push(value));
  const other = solution.createEditor(host(), value => calls.push('other:' + value));
  assert.ok(editor instanceof View);
  const send = (node, modifiers = {}) => node.dispatchEvent(new window.KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    ...modifiers
  }));
  let input = editor.el.querySelector('textarea');
  input.value = 'Draft';
  send(input);
  send(input, {
    ctrlKey: true
  });
  assert.deepEqual(calls, ['Draft']);
  const otherInput = other.el.querySelector('textarea');
  otherInput.value = 'Separate';
  send(otherInput, { ctrlKey: true });
  assert.deepEqual(calls, ['Draft', 'other:Separate']);
  calls.length = 0;
  editor.render();
  input = editor.el.querySelector('textarea');
  input.value = 'Again';
  send(input, {
    metaKey: true
  });
  assert.deepEqual(calls, ['Again']);
  editor.destroy();
  send(input, {
    ctrlKey: true
  });
  assert.deepEqual(calls, ['Again']);
  other.destroy();
});
