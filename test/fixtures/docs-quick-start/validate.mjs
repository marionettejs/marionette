import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const documentUrl = new URL('../../../docs/quick-start.md', import.meta.url);
const source = await readFile(documentUrl, 'utf8');
const output = new URL('./dist/', import.meta.url);
await mkdir(output, { recursive: true });
async function example(marker, name) {
  assert.equal(source.split(marker).length, 2);
  const code = source.slice(source.indexOf(marker) + marker.length).match(/^\s*```javascript\n([\s\S]*?)\n```/);
  assert.ok(code);
  const url = new URL(name, output);
  await writeFile(url, code[1]);
  return import(url);
}
const dom = new JSDOM('<!doctype html><main id="app"></main><main id="feature"></main>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const { Region } = await import('marionette');
const { region, screen } = await example('<!-- executable-example: quick-start-screen -->', 'screen.mjs');
assert.equal(screen.el.querySelectorAll('li').length, 2);
screen.el.querySelector('button').click();
assert.equal(screen.el.querySelector('output').textContent, 'First post');
const rows = screen.getChildView('rows');
const first = rows.children.findByIndex(0);
rows.collection.push({ label: 'Third post' });
assert.equal(rows.children.length, 2);
rows.render();
assert.equal(rows.children.length, 3);
assert.equal(first.isDestroyed(), true);
region.destroy();
assert.equal(screen.isDestroyed(), true);
assert.equal(rows.isDestroyed(), true);

const { Search } = await example('<!-- executable-example: quick-start-behavior -->', 'behavior.mjs');
const search = new Search();
const searchRegion = new Region({ el: '#app' });
searchRegion.show(search);
const queries = [];
let clearedControl;
search.on('query:changed', (value, control) => {
  queries.push(value);
  clearedControl = control;
});
const input = search.getUI('query')[0];
input.value = 'hello';
input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
const clearButton = search.el.querySelector('button');
clearButton.querySelector('span').click();
assert.equal(clearedControl, clearButton, 'delegateTarget identifies the matched button for a nested click');
assert.deepEqual(queries, ['hello', '']);
assert.equal(input.value, '');
searchRegion.destroy();

const { mountFeature } = await example('<!-- executable-example: quick-start-application -->', 'application.mjs');
const feature = await mountFeature(document.querySelector('#feature'));
assert.equal(feature.application.isRunning(), true);
assert.equal(document.querySelector('#feature').textContent, 'Ready');
const previous = feature.application.getView();
feature.refresh();
assert.equal(previous.isDestroyed(), true);
await feature.destroy();
assert.equal(feature.application.isDestroyed(), true);
feature.refresh();
assert.equal(document.querySelector('#feature').textContent, '');
dom.window.close();
console.log('Quick-start documentation examples passed.');
