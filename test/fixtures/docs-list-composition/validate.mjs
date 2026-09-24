import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const markdown = await readFile(new URL('../../../docs/list-composition.md', import.meta.url), 'utf8');
await mkdir(new URL('./dist/', import.meta.url), { recursive: true });
const marker = '<!-- executable-example: interactive-managed-list -->';
assert.equal(markdown.split(marker).length - 1, 1);
const code = markdown.slice(markdown.indexOf(marker) + marker.length)
  .match(/^\s*```javascript\n([\s\S]*?)\n```/);
assert.ok(code);
await writeFile(new URL('./dist/interactive-list.js', import.meta.url), code[1]);
const dom = new JSDOM('<!doctype html><main></main>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const host = document.querySelector('main');
const { mountList } = await import('./dist/interactive-list.js');
let active = 0;
const observeRow = () => {
  active++;
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
} finally {
  feature?.destroy();
  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
}
console.log('Interactive list example passed: selection, updates, identity, and cleanup.');
