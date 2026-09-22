import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const markdown = await readFile(new URL('../../../docs/dom.interactions.md', import.meta.url), 'utf8');
const marker = '<!-- executable-example: native-hover-nested-click -->';
const code = markdown.slice(markdown.indexOf(marker) + marker.length)
  .match(/^\s*```javascript\n([\s\S]*?)\n```/);
assert.ok(code);
const output = new URL('./dist/boundaries.mjs', import.meta.url);
await writeFile(output, code[1]);
const dom = new JSDOM('<!doctype html><main></main>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const { RowView } = await import(output);
const { View } = await import('marionette');
const view = new RowView().render();
const trace = [];
view.on('row:open', () => trace.push('open'));
view.on('row:save', control => { assert.equal(control, button); trace.push('save'); });
view.on('row:enter', () => trace.push('enter'));
view.on('row:leave', () => trace.push('leave'));
document.querySelector('main').append(view.el);
const row = view.el.querySelector('.row');
const button = view.el.querySelector('button');
const icon = button.querySelector('span');
try {
  icon.click();
  row.querySelector('span').click();
  assert.deepEqual(trace, ['save', 'open']);
  row.dispatchEvent(new dom.window.MouseEvent('mouseover', { bubbles: true }));
  icon.dispatchEvent(new dom.window.MouseEvent('mouseover', { bubbles: true, relatedTarget: row }));
  icon.dispatchEvent(new dom.window.MouseEvent('mouseout', { bubbles: true, relatedTarget: button }));
  row.dispatchEvent(new dom.window.MouseEvent('mouseout', { bubbles: true }));
  assert.deepEqual(trace, ['save', 'open', 'enter', 'leave']);
  let enters = 0;
  view.delegateEvents({ 'mouseenter .row': () => enters++ });
  row.dispatchEvent(new dom.window.MouseEvent('mouseenter', { bubbles: false }));
  assert.equal(enters, 0);
  view.delegateEvents({ mouseenter: () => enters++ });
  view.el.dispatchEvent(new dom.window.MouseEvent('mouseenter', { bubbles: false }));
  assert.equal(enters, 1);
  view.destroy();
  icon.click();
  assert.equal(trace.length, 4);

  const order = [];
  const Ordered = View.extend({
    template: () => '<button><span>Action</span></button>',
    events: {
      'click button': event => { order.push('event'); event.stopPropagation(); return false; },
      'click span': () => order.push('second')
    },
    triggers: { 'click button': 'action' },
    onAction() { order.push('trigger'); }
  });
  const ordered = new Ordered().render();
  document.body.append(ordered.el);
  const ancestor = () => order.push('ancestor');
  document.body.addEventListener('click', ancestor);
  try {
    ordered.el.querySelector('span').click();
    assert.deepEqual(order, ['event', 'second', 'trigger']);
    order.length = 0;
    ordered.delegateEvents({ 'click button': event => { order.push('immediate'); event.stopImmediatePropagation(); } });
    ordered.el.querySelector('span').click();
    assert.deepEqual(order, ['immediate']);
  } finally { document.body.removeEventListener('click', ancestor); ordered.destroy(); }
} finally {
  view.destroy();
  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
}
console.log('Native boundary example passed: nested action, hover transitions, non-bubbling entry, registration order and propagation.');
