import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const markdown = await readFile(resolve(fixtureDir, '../../../docs/view.rendering.md'), 'utf8');
const marker = '<!-- executable-example: view-literal-false-template -->';
assert.equal(markdown.split(marker).length - 1, 1);
const example = markdown.slice(markdown.indexOf(marker) + marker.length)
  .match(/^\s*```javascript\n([\s\S]*?)\n```/);
assert.ok(example, 'the view-literal-false-template marker must have a JavaScript fence');
await mkdir(resolve(fixtureDir, 'dist'), { recursive: true });
const examplePath = resolve(fixtureDir, 'dist/view-literal-false-template.mjs');
await writeFile(examplePath, example[1]);
const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;

try {
  const { DraftView } = await import(pathToFileURL(examplePath));
  const { Region, View } = await import('marionette');
  const host = document.createElement('main');
  document.body.append(host);
  const region = new Region({ el: host });
  const view = new DraftView({ ui: { input: 'input' } });
  const input = view.el.querySelector('input');
  input.value = 'unsaved';
  let renders = 0;
  view.on('before:render', () => { renders += 1; });
  view.on('render', () => { renders += 1; });
  region.show(view);
  view.render();
  assert.equal(view.el.querySelector('input'), input);
  assert.equal(input.value, 'unsaved');
  assert.equal(renders, 0);
  assert.equal(view.isRendered(), true);
  assert.throws(() => view.getUI('input'));
  view.bindUIElements();
  assert.equal(view.getUI('input')[0], input);
  region.destroy();
  assert.equal(view.isDestroyed(), true);

  // A function returning false is still rendered: it does not opt out.
  const wrong = new View({ template: () => false });
  const discarded = document.createElement('input');
  wrong.el.append(discarded);
  wrong.render();
  assert.equal(wrong.el.contains(discarded), false);
  assert.equal(wrong.el.textContent, 'false');
  wrong.destroy();
  host.remove();
} finally {
  dom.window.close();
  delete globalThis.document;
  delete globalThis.window;
}
