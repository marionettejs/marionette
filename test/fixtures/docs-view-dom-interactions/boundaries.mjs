import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const markdown = await readFile(new URL('../../../docs/dom.interactions.md', import.meta.url), 'utf8');
const marker = '<!-- executable-example: native-hover-nested-click -->';
assert.equal(markdown.split(marker).length - 1, 1, `expected one ${marker}`);
const code = markdown.slice(markdown.indexOf(marker) + marker.length)
  .match(/^\s*```javascript\n([\s\S]*?)\n```/);
assert.ok(code);
await mkdir(new URL('./dist/', import.meta.url), { recursive: true });
const output = new URL('./dist/boundaries.mjs', import.meta.url);
await writeFile(output, code[1]);
const dom = new JSDOM('<!doctype html><main></main>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const { RowView } = await import(output);
const { View } = await import('marionette');
const trace = [];
// Public hooks remain callable after destroy; removed event subscriptions cannot
// conceal a leaked DOM handler from these observations.
const ObservedRow = RowView.extend({
  onRowOpen() { trace.push('open'); },
  onRowSave(control) { assert.equal(control, button); trace.push('save'); },
  onRowEnter() { trace.push('enter'); },
  onRowLeave() { trace.push('leave'); }
});
const view = new ObservedRow().render();
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
  const entryProbe = new RowView().render();
  try {
    let enters = 0;
    entryProbe.delegateEvents({ 'mouseenter .row': () => enters++ });
    entryProbe.el.querySelector('.row').dispatchEvent(new dom.window.MouseEvent('mouseenter', { bubbles: false }));
    assert.equal(enters, 0);
    entryProbe.delegateEvents({ mouseenter: () => enters++ });
    entryProbe.el.dispatchEvent(new dom.window.MouseEvent('mouseenter', { bubbles: false }));
    assert.equal(enters, 1);
  } finally { entryProbe.destroy(); }

  // This View still has its original click and hover registrations at destruction.
  view.destroy();
  icon.click();
  row.dispatchEvent(new dom.window.MouseEvent('mouseover', { bubbles: true }));
  assert.deepEqual(trace, ['save', 'open', 'enter', 'leave']);

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
  if (!view.isDestroyed()) { view.destroy(); }
  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
}
console.log('Native boundary example passed: nested action, hover transitions, non-bubbling entry, registration order and propagation.');
