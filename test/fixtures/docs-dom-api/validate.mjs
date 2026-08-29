import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { DomApi, Region, View } from 'marionette';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsPath = resolve(__dirname, '../../../docs/dom.api.md');
const markdown = await readFile(docsPath, 'utf8');
const marker = '<!-- executable-example: dom-api-partial-override -->';
const methodsSection = markdown
  .slice(markdown.indexOf('## Native API methods'), markdown.indexOf('## Using the default API'));
const documentedMethods = [...methodsSection.matchAll(/^### `([A-Za-z][A-Za-z0-9]*)\(/gm)]
  .map(([, method]) => method)
  .sort();
const shippedMethods = Object.keys(DomApi).sort();

assert.deepEqual(
  documentedMethods,
  shippedMethods,
  'documented native method headings must match the shipped DomApi',
);
assert.equal(markdown.split(marker).length - 1, 1, 'expected one executable example marker');

const markedContent = markdown.slice(markdown.indexOf(marker) + marker.length);
const codeFence = markedContent.match(/^\s*```javascript\n([\s\S]*?)\n```/);

assert.ok(codeFence, 'expected a JavaScript fence immediately after the marker');

const distDir = resolve(__dirname, 'dist');
const examplePath = resolve(distDir, 'example.mjs');

await mkdir(distDir, { recursive: true });
await writeFile(examplePath, `${codeFence[1]}\n`, 'utf8');

function createDom() {
  const dom = new JSDOM('<!doctype html><html><body><main id="region-host"></main></body></html>');

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  return dom;
}

function destroyDom(dom) {
  dom.window.close();
  delete globalThis.document;
  delete globalThis.window;
}

function assertExampleRun(renderPlainText, dom) {
  const view = renderPlainText();

  assert.equal(
    view.el.textContent,
    '<strong>Literal markup</strong>',
    'the documented override must render template output as text',
  );
  assert.equal(view.el.querySelector('strong'), null, 'the override must not parse template markup');
  assert.equal(view.Dom.createElement, DomApi.createElement, 'the partial override must retain native methods');
  assert.equal(view.$('strong') instanceof dom.window.NodeList, true, 'View#$ must remain native');
  assert.equal('$el' in view, false, 'the native adapter must not create $el');

  view.destroy();
  assert.equal(view.isDestroyed(), true, 'each example run must cleanly destroy its View');
  return view;
}

async function runExample(run) {
  const dom = createDom();

  try {
    const exampleUrl = new URL(pathToFileURL(examplePath));
    exampleUrl.searchParams.set('run', run);
    const { PlainTextView, renderPlainText } = await import(exampleUrl);
    const firstView = assertExampleRun(renderPlainText, dom);
    const secondView = assertExampleRun(renderPlainText, dom);

    assert.notEqual(firstView, secondView, 'repeated calls must create fresh View instances');

    return PlainTextView;
  } finally {
    destroyDom(dom);
  }
}

const firstPlainTextView = await runExample('first');
const secondPlainTextView = await runExample('second');

assert.notEqual(firstPlainTextView, secondPlainTextView, 'repeated runs must reload the example');
assert.notEqual(firstPlainTextView.prototype.Dom, View.prototype.Dom, 'the override must be class-local');
assert.notEqual(secondPlainTextView.prototype.Dom, View.prototype.Dom, 'the override must remain class-local');
assert.equal(View.prototype.Dom.setContents, DomApi.setContents, 'the base View must remain native');

const dom = createDom();

try {
  const baseView = new View({ template: () => '<strong>Parsed markup</strong>' });
  baseView.render();
  assert.equal(baseView.el.querySelector('strong')?.textContent, 'Parsed markup');
  assert.equal(baseView.$('strong') instanceof dom.window.NodeList, true);
  assert.equal('$el' in baseView, false);
  baseView.destroy();

  const region = new Region({ el: '#region-host' });
  region.show(new View({ template: false }));
  assert.equal(region.el, document.querySelector('#region-host'), 'Region must retain selector resolution');
  region.destroy();

  assert.throws(
    () => new View({ el: '#region-host' }),
    error => error?.code === 'MN0001',
    'View must reject selector-string el values with MN0001',
  );
} finally {
  destroyDom(dom);
}
