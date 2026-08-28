import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsPath = resolve(__dirname, '../../../docs/marionette.behavior.md');
const marker = '<!-- executable-example: behavior-host-communication -->';
const markdown = await readFile(docsPath, 'utf8');

assert.equal(markdown.split(marker).length - 1, 1, 'expected one executable example marker');

const markedContent = markdown.slice(markdown.indexOf(marker) + marker.length);
const codeFence = markedContent.match(/^\s*```javascript\n([\s\S]*?)\n```/);

assert.ok(codeFence, 'expected a JavaScript fence immediately after the marker');

const distDir = resolve(__dirname, 'dist');
const examplePath = resolve(distDir, 'example.mjs');

await mkdir(distDir, { recursive: true });
await writeFile(examplePath, codeFence[1], 'utf8');

const dom = new JSDOM(`<!doctype html>
  <html>
    <body>
      <button class="save" id="outside" type="button">Outside</button>
      <main id="host"></main>
    </body>
  </html>`);

globalThis.window = dom.window;
globalThis.document = dom.window.document;

try {
  const { FormView } = await import(pathToFileURL(examplePath));
  const view = new FormView();
  let requestCount = 0;
  let requestedView;

  view.on('save:requested', currentView => {
    requestCount += 1;
    requestedView = currentView;
  });

  view.render();
  document.querySelector('#host').append(view.el);

  const outsideButton = document.querySelector('#outside');
  const hostButton = view.el.querySelector('.save');

  outsideButton.click();
  assert.equal(requestCount, 0, 'outside-host DOM must not trigger the Behavior');

  hostButton.click();
  assert.equal(requestCount, 1, 'the host button must request save exactly once');
  assert.equal(requestedView, view, 'the host must receive its View as the request argument');

  view.destroy();
  hostButton.click();
  assert.equal(requestCount, 1, 'destroy must undelegate the retained host button');
} finally {
  dom.window.close();
  delete globalThis.document;
  delete globalThis.window;
}
