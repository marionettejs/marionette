import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsPath = resolve(__dirname, '../../../docs/marionette.behavior.md');
const markdown = await readFile(docsPath, 'utf8');
const distDir = resolve(__dirname, 'dist');
const examples = [
  {
    marker: '<!-- executable-example: behavior-host-communication -->',
    path: resolve(distDir, 'host-communication.mjs'),
  },
  {
    marker: '<!-- executable-example: behavior-ui-resolution -->',
    path: resolve(distDir, 'ui-resolution.mjs'),
  },
];

await mkdir(distDir, { recursive: true });

for (const example of examples) {
  assert.equal(
    markdown.split(example.marker).length - 1,
    1,
    `expected one ${example.marker} marker`,
  );

  const markedContent = markdown.slice(markdown.indexOf(example.marker) + example.marker.length);
  const codeFence = markedContent.match(/^\s*```javascript\n([\s\S]*?)\n```/);

  assert.ok(codeFence, `expected a JavaScript fence immediately after ${example.marker}`);
  await writeFile(example.path, codeFence[1], 'utf8');
}

const dom = new JSDOM(`<!doctype html>
  <html>
    <body>
      <button class="save" id="outside-save" type="button">Outside</button>
      <button class="btn-primary" id="outside-primary" type="button">Outside primary</button>
      <main id="communication-host"></main>
      <main id="ui-host"></main>
    </body>
  </html>`);

globalThis.window = dom.window;
globalThis.document = dom.window.document;

try {
  const [{ FormView: CommunicationView }, { FormView: UiResolutionView }] = await Promise.all(
    examples.map(example => import(pathToFileURL(example.path))),
  );

  {
    const view = new CommunicationView();
    let requestCount = 0;
    let requestedView;

    view.on('save:requested', currentView => {
      requestCount += 1;
      requestedView = currentView;
    });

    view.render();
    document.querySelector('#communication-host').append(view.el);

    const outsideButton = document.querySelector('#outside-save');
    const hostButton = view.el.querySelector('.save');

    outsideButton.click();
    assert.equal(requestCount, 0, 'outside-host DOM must not trigger the Behavior');

    hostButton.click();
    assert.equal(requestCount, 1, 'the host button must request save exactly once');
    assert.equal(requestedView, view, 'the host must receive its View as the request argument');

    view.destroy();
    hostButton.click();
    assert.equal(requestCount, 1, 'destroy must undelegate the retained host button');
  }

  {
    const view = new UiResolutionView();
    let requestCount = 0;
    let requestedView;

    view.on('save:requested', currentView => {
      requestCount += 1;
      requestedView = currentView;
    });

    view.render();
    document.querySelector('#ui-host').append(view.el);

    const outsideButton = document.querySelector('#outside-primary');
    const defaultButton = view.el.querySelector('.btn-save');
    const firstPrimaryButton = view.el.querySelector('.btn-primary');

    outsideButton.click();
    defaultButton.click();
    assert.equal(requestCount, 0, 'only the host-scoped winning selector must trigger the Behavior');

    firstPrimaryButton.click();
    assert.equal(requestCount, 1, 'the host UI override must request save exactly once');
    assert.equal(requestedView, view, 'the UI override must request work from its host View');
    assert.ok(firstPrimaryButton.classList.contains('is-saving'), 'the current UI must be marked');

    view.render();
    const secondPrimaryButton = view.el.querySelector('.btn-primary');

    assert.notEqual(secondPrimaryButton, firstPrimaryButton, 'rerender must replace the UI element');
    assert.ok(!secondPrimaryButton.classList.contains('is-saving'), 'replacement UI must start unmarked');

    secondPrimaryButton.click();
    assert.equal(requestCount, 2, 'the rebound replacement must request save exactly once');
    assert.ok(secondPrimaryButton.classList.contains('is-saving'), 'the rebound current UI must be marked');

    view.destroy();
    secondPrimaryButton.click();
    assert.equal(requestCount, 2, 'destroy must undelegate the rebound UI element');
  }
} finally {
  dom.window.close();
  delete globalThis.document;
  delete globalThis.window;
}
