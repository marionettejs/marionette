import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const markdown = await readFile(new URL('../../../docs/list-composition.md', import.meta.url), 'utf8');
await mkdir(new URL('./dist/', import.meta.url), { recursive: true });
for (const [marker, filename] of [
  ['<!-- executable-example: interactive-managed-list -->', 'interactive-list.js'],
  ['<!-- executable-example: bounded-managed-list -->', 'bounded-list.js'],
]) {
  assert.equal(markdown.split(marker).length - 1, 1);
  const code = markdown.slice(markdown.indexOf(marker) + marker.length)
    .match(/^\s*```javascript\n([\s\S]*?)\n```/);
  assert.ok(code);
  await writeFile(new URL(`./dist/${filename}`, import.meta.url), code[1]);
}
const dom = new JSDOM('<!doctype html><main></main>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const host = document.querySelector('main');
const { mountList } = await import('./dist/interactive-list.js');
const { mountWindow } = await import('./dist/bounded-list.js');
let active = 0;
let peak = 0;
let constructions = 0;
const observeRow = () => {
  active++;
  constructions++;
  peak = Math.max(peak, active);
  return () => { active--; };
};
let feature;
try {
  feature = mountList(host, [{ id: 1, title: '<First>' }, { id: 2, title: 'Second' }], observeRow);
  const { list, collection } = feature;
  const survivor = list.children.findByModel(collection.get(2));
  const input = survivor.getUI('draft')[0];
  input.value = 'Uncommitted draft';
  let selection;
  list.on('selection', id => { selection = id; });
  survivor.getUI('select')[0].click();
  assert.equal(selection, 2);
  assert.equal(survivor.getUI('select')[0].getAttribute('aria-pressed'), 'true');
  assert.equal(host.querySelector('button').textContent, '<First>');
  collection.get(2).set('title', 'Updated title');
  assert.equal(survivor.getUI('select')[0].textContent, 'Updated title');
  collection.add({ id: 3, title: 'Third' });
  collection.move(2, 0);
  collection.remove(1);
  assert.equal(list.children.findByModel(collection.get(2)), survivor);
  assert.equal(survivor.getUI('draft')[0], input);
  assert.equal(input.value, 'Uncommitted draft');
  assert.equal(list.el.firstElementChild, survivor.el);
  assert.equal(active, 2);
  feature.destroy();
  assert.equal(survivor.isDestroyed(), true);
  assert.equal(active, 0);
  assert.equal(host.children.length, 0);

  constructions = 0;
  peak = 0;
  const records = Array.from({ length: 100000 }, (_, id) => ({ id, title: `Post ${id}` }));
  feature = mountWindow(host, records, { observeRow });
  assert.equal(constructions, feature.capacity);
  const initial = feature.list.children.findByModel(feature.visible.get(0));
  const overlapping = feature.list.children.findByModel(feature.visible.get(5));
  const draft = overlapping.getUI('draft')[0];
  draft.value = 'Keep while visible';
  feature.viewport.el.scrollTop = 160;
  feature.viewport.el.dispatchEvent(new window.Event('scroll'));
  assert.equal(initial.isDestroyed(), true);
  assert.equal(feature.list.children.findByModel(feature.visible.get(5)), overlapping);
  assert.equal(overlapping.getUI('draft')[0], draft);
  assert.equal(draft.value, 'Keep while visible');
  assert.equal(feature.list.el.style.top, '80px');
  feature.viewport.el.scrollTop = 4000000;
  feature.viewport.el.dispatchEvent(new window.Event('scroll'));
  assert.equal(overlapping.isDestroyed(), true);
  assert.equal(feature.visible.at(feature.visible.length - 1).id, 99999);
  assert.equal(feature.list.children.length, feature.capacity);
  assert.equal(peak, feature.capacity);
  const rows = feature.list.children.toArray();
  const viewportElement = feature.viewport.el;
  feature.destroy();
  assert.equal(active, 0);
  assert.equal(rows.every(row => row.isDestroyed()), true);
  assert.equal(host.children.length, 0);
  const before = constructions;
  viewportElement.scrollTop = 0;
  viewportElement.dispatchEvent(new window.Event('scroll'));
  assert.equal(constructions, before, 'teardown removes the application scroll listener');
} finally {
  feature?.destroy();
  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
}
console.log('Managed list examples passed: selection, identity, bounded rows, and cleanup.');
