import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const markdown = await readFile(resolve(fixtureDir, '../../../docs/dom.prerendered.md'), 'utf8');
const marker = '<!-- executable-example: prerendered-owned-tree -->';
assert.equal(markdown.split(marker).length - 1, 1);
const example = markdown.slice(markdown.indexOf(marker) + marker.length)
  .match(/^\s*```javascript\n([\s\S]*?)\n```/);
assert.ok(example, 'the marked example must have a JavaScript fence');

const dom = new JSDOM(`<!doctype html><main id="base-layout">
  <div id="header-region"><header><h1>Existing account</h1></header></div>
  <div id="content-region"></div>
</main>`);
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const originalHeader = document.querySelector('header');
const originalHeading = document.querySelector('h1');

const outputDir = resolve(fixtureDir, 'dist');
await mkdir(outputDir, { recursive: true });
const examplePath = resolve(outputDir, 'example.mjs');
await writeFile(examplePath, example[1]);

try {
  const { layout } = await import(pathToFileURL(examplePath));
  const child = layout.getChildView('header');
  assert.equal(child.el, originalHeader, 'reuse the existing header element');
  assert.equal(document.querySelector('h1'), originalHeading, 'do not replace existing content');
  assert.equal(child.el.textContent, 'Existing account', 'do not render the new-content template');
  assert.equal(layout.getRegion('header').currentView, child, 'the Region owns the shown child');
  assert.equal(child.isRendered(), true);
  assert.equal(child.isAttached(), true);

  layout.destroy();
  assert.equal(child.isDestroyed(), true, 'parent destruction cleans up the child');
  assert.equal(originalHeader.isConnected, false);
  assert.equal(document.querySelector('#base-layout'), null, 'the owner removes its root');
  console.log('Verified prerendered ownership, existing DOM identity, and teardown.');
} finally {
  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
}
