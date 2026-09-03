import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsPath = resolve(__dirname, '../../../docs/marionette.view.md');
const marker = '<!-- executable-example: view-render-attributes -->';
const markdown = await readFile(docsPath, 'utf8');

assert.equal(markdown.split(marker).length - 1, 1, 'expected one executable example marker');

const markedContent = markdown.slice(markdown.indexOf(marker) + marker.length);
const codeFence = markedContent.match(/^\s*```javascript\n([\s\S]*?)\n```/);

assert.ok(codeFence, 'expected a JavaScript fence immediately after the marker');

const distDir = resolve(__dirname, 'dist');
const examplePath = resolve(distDir, 'example.mjs');

await mkdir(distDir, { recursive: true });
await writeFile(examplePath, `${codeFence[1]}\n`, 'utf8');

const dom = new JSDOM('<!doctype html><html><body></body></html>');

globalThis.window = dom.window;
globalThis.document = dom.window.document;

try {
  const { rootElement, row } = await import(pathToFileURL(examplePath));

  assert.equal(row.el, rootElement, 'the root element must retain identity');
  assert.equal(rootElement.className, 'danger');
  assert.equal(rootElement.getAttribute('aria-selected'), 'true');

  row.setSelected(false);

  assert.equal(row.el, rootElement, 'deselection must retain root identity');
  assert.equal(rootElement.className, '');
  assert.equal(rootElement.getAttribute('aria-selected'), 'false');

  row.destroy();
} finally {
  dom.window.close();
  delete globalThis.document;
  delete globalThis.window;
}
