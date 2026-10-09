import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><main id="mount"></main>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const { CollectionView, View } = await import('marionette');
const { Collection } = await import('@marionette/data');
const { createList } = await import('./solution.mjs');
const mount = document.getElementById('mount');
const list = createList({ el: mount, records: [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Bravo' },
  { id: 'c', label: 'Charlie' }
] });
assert.ok(list.view instanceof CollectionView);
assert.ok(list.collection instanceof Collection);
assert.equal(list.view.el.parentElement, mount);
assert.ok(list.view.isAttached());
const initialRows = list.view.children.toArray();
for (const row of initialRows) {
  assert.ok(row instanceof View);
  assert.ok(row.isAttached());
  assert.equal(row.el.dataset.id, row.model.get('id'));
  const input = row.el.querySelector('input');
  assert.equal(input.value, row.model.get('label'));
  assert.match(input.labels[0].textContent, /Label/);
}
const survivor = list.view.children.findByModel(list.collection.get('b'));
const input = survivor.el.querySelector('input');
input.focus();
input.value = 'Unsaved draft';
input.setSelectionRange(2, 5);
input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
const order = () => Array.from(list.view.el.children, el => el.dataset.id);
function retained(expectedOrder) {
  assert.deepEqual(order(), expectedOrder);
  assert.equal(list.view.children.findByModel(list.collection.get('b')), survivor);
  assert.equal(survivor.el.querySelector('input'), input);
  assert.equal(input.value, 'Unsaved draft');
  assert.equal(list.collection.get('b').get('label'), 'Bravo');
}
list.add({ id: 'd', label: '<img src=x onerror=alert(1)>' });
retained(['a', 'b', 'c', 'd']);
const addedInput = list.view.children.findByModel(list.collection.get('d')).el.querySelector('input');
assert.equal(addedInput.value, '<img src=x onerror=alert(1)>');
assert.equal(mount.querySelector('img'), null);
list.move('d', 0);
retained(['d', 'a', 'b', 'c']);
list.move('a', 3);
retained(['d', 'b', 'c', 'a']);
const removed = list.view.children.findByModel(list.collection.get('c'));
list.remove('c');
retained(['d', 'b', 'a']);
assert.ok(removed.isDestroyed());
assert.equal(removed.el.isConnected, false);
list.move('b', 0);
retained(['b', 'd', 'a']);
const survivingRows = list.view.children.toArray();
list.dispose();
assert.ok(list.view.isDestroyed());
for (const row of survivingRows) assert.ok(row.isDestroyed());
assert.equal(mount.isConnected, true);
assert.equal(mount.childElementCount, 0);
list.dispose();
assert.equal(mount.childElementCount, 0);
const empty = createList({ el: mount, records: [] });
empty.add({ id: 0, label: 'Zero' });
assert.equal(empty.view.el.firstElementChild.dataset.id, '0');
empty.remove(0);
assert.equal(empty.view.children.length, 0);
empty.dispose();
dom.window.close();
console.log('PASS: native collection operations, row/input/draft retention, literal labels, attachment, cleanup, empty lists and numeric ids.');
