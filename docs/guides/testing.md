# Test a consumer application

Test what a user or owning component can observe: rendered content, interaction, readiness, and disposal. A local editing View needs no Application. An Application test is useful when a feature must prepare before showing its screen.

This recipe uses Node's built-in test runner and JSDOM. Use Node 24 or later. First install `marionette`, `@mnjs/adapters`, `lit-html`, and `@mnjs/data` using the [candidate installation](../quick-start.md) and [data setup](../integrations/setup.md). Add the DOM implementation used here:

```sh
npm install --save-dev --save-exact jsdom@30.1.0
```

Create these four files in a `test` directory. The `.mjs` extension works without changing your application's module configuration. The example configures data and rendering on its own View classes to keep this recipe self-contained. Tests of your real classes should import your application setup module after the DOM preload and before those classes, as described in [integration setup](../integrations/setup.md). `@mnjs/data` supplies optional observable attributes; API requests and persistence need a separate layer or another data solution.

## `test/dom.mjs`

Install the DOM before importing Marionette and Lit. Both can capture their DOM environment during module initialization.

```js
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://example.test/',
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
```

## `test/title-editor.mjs`

This local interaction changes only the View's own model. Lit retains the input across renders, and `live` compares the binding with its current DOM value.

```js
import { View } from 'marionette';
import { DataApi } from '@mnjs/data';
import LitDomApi from '@mnjs/adapters/dom/lit-html';
import { html } from 'lit-html';
import { live } from 'lit-html/directives/live.js';

export const TitleEditor = View.extend({
  template: ({ title }) => html`
    <label>Title <input class="title" .value=${live(title)}></label>
    <p class="preview">${title}</p>
  `,
  ui: { title: '.title' },
  events: { 'input @ui.title': 'editTitle' },
  modelEvents: { 'change:title': 'render' },
  editTitle() {
    this.model.set('title', this.getUI('title')[0].value);
  },
}).setDataApi(DataApi).setDomApi(LitDomApi);
```

## `test/summary-application.mjs`

Readiness stays with the Application. The feature requests `/summary.json`, which returns an object with a string `title`. Tests replace `fetch` to hold, resolve, or reject this boundary without a network or arbitrary delay.

```js
import { Application, View } from 'marionette';
import LitDomApi from '@mnjs/adapters/dom/lit-html';
import { html } from 'lit-html';

const SummaryView = View.extend({
  template: ({ title }) => html`<h1>${title}</h1>`,
}).setDomApi(LitDomApi);

export const SummaryApplication = Application.extend({
  async prepareStart(_options, { signal }) {
    const response = await fetch('/summary.json', { signal });
    if (!response.ok) throw new Error('Could not load the summary.');
    return response.json();
  },
  onStart(_app, _options, summary) {
    this.showView(new SummaryView({ model: summary }));
  },
});
```

The test runner restores its `fetch` mock after each test. Keep this recipe's tests sequential because they share a DOM and a global fetch boundary.

## `test/app.test.mjs`

Each test owns a mount and disposes the resources it creates. Assertions use public methods and DOM outcomes; they avoid listener tables, internal flags, and lifecycle implementation details. The replacement test spies on the public `render` method to detect a removed View reacting to a shared Model, even if rendering a destroyed View would make no visible change.

```js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Region, View } from 'marionette';
import { Model } from '@mnjs/data';
import { TitleEditor } from './title-editor.mjs';
import { SummaryApplication } from './summary-application.mjs';

test('editing updates the model and rendered title', t => {
  const mount = document.body.appendChild(document.createElement('section'));
  const region = new Region({ el: mount });
  const model = new Model({ title: 'Untitled' });
  t.after(() => { region.destroy(); model.destroy(); mount.remove(); });
  const editor = new TitleEditor({ model });
  region.show(editor);

  const input = editor.getUI('title')[0];
  input.value = 'Edited';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal(model.get('title'), 'Edited');
  assert.equal(editor.el.querySelector('.preview').textContent, 'Edited');
  assert.equal(editor.getUI('title')[0], input);
  model.set('title', 'External change');
  assert.equal(input.value, 'External change');
});

test('replacing a Region destroys the old View and releases its subscriptions', t => {
  const renders = t.mock.method(TitleEditor.prototype, 'render');
  const mount = document.body.appendChild(document.createElement('section'));
  const region = new Region({ el: mount });
  const model = new Model({ title: 'Original' });
  t.after(() => { region.destroy(); model.destroy(); mount.remove(); });
  const editor = new TitleEditor({ model });
  region.show(editor);
  const input = editor.getUI('title')[0];
  const oldRoot = editor.el;
  const replacement = new View({ template: () => '<p>Replacement</p>' });
  region.show(replacement);

  assert.equal(editor.isDestroyed(), true);
  assert.equal(oldRoot.isConnected, false);
  assert.equal(region.currentView, replacement);
  assert.equal(model.isDestroyed(), false);
  const renderCount = renders.mock.callCount();
  model.set('title', 'Still borrowed');
  assert.equal(renders.mock.callCount(), renderCount);
  assert.equal(oldRoot.querySelector('.preview').textContent, 'Original');
  input.value = 'Removed control';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal(model.get('title'), 'Still borrowed');
  assert.equal(mount.textContent, 'Replacement');
});

test('readiness precedes activation and stop destroys the screen', async t => {
  const mount = document.body.appendChild(document.createElement('section'));
  const request = Promise.withResolvers();
  t.mock.method(globalThis, 'fetch', () => request.promise);
  const app = new SummaryApplication({ region: { el: mount } });
  t.after(async () => { await app.destroy(); mount.remove(); });
  const starting = app.start();
  assert.equal(app.isRunning(), false);
  assert.equal(mount.childElementCount, 0);
  request.resolve(new Response(JSON.stringify({ title: 'Ready summary' })));
  assert.equal(await starting, true);
  assert.equal(app.isRunning(), true);
  assert.equal(mount.querySelector('h1').textContent, 'Ready summary');
  const screen = app.getView();

  assert.equal(await app.stop(), true);
  assert.equal(app.isRunning(), false);
  assert.equal(screen.isDestroyed(), true);
  assert.equal(mount.childElementCount, 0);
  const region = app.getRegion();
  assert.equal(await app.destroy(), true);
  assert.equal(app.isDestroyed(), true);
  assert.equal(region.isDestroyed(), true);
});

test('failed readiness leaves an initially stopped feature without a screen', async t => {
  const mount = document.body.appendChild(document.createElement('section'));
  const failure = new Error('Unavailable');
  t.mock.method(globalThis, 'fetch', async () => { throw failure; });
  const app = new SummaryApplication({ region: { el: mount } });
  t.after(async () => { await app.destroy(); mount.remove(); });
  await assert.rejects(app.start(), error => error === failure);
  assert.equal(app.isRunning(), false);
  assert.equal(app.getView(), undefined);
  assert.equal(mount.childElementCount, 0);
});

test('stop cancels pending readiness and an obsolete result cannot show UI', async t => {
  const mount = document.body.appendChild(document.createElement('section'));
  const request = Promise.withResolvers();
  let preparationSignal;
  t.mock.method(globalThis, 'fetch', (_url, { signal }) => {
    preparationSignal = signal;
    return request.promise;
  });
  const app = new SummaryApplication({ region: { el: mount } });
  t.after(async () => { await app.destroy(); mount.remove(); });
  const starting = app.start();
  await app.stop();
  assert.equal(preparationSignal.aborted, true);
  request.resolve(new Response(JSON.stringify({ title: 'Obsolete summary' })));
  assert.equal(await starting, false);
  assert.equal(app.isRunning(), false);
  assert.equal(mount.childElementCount, 0);
});
```

The render spy checks that a disposed editor no longer reacts to its borrowed Model. Unchanged DOM alone could miss a leaked callback because a destroyed View ignores rendering. For a View that updates through another public handler, observe that handler or its external effect instead.

Run the test file with the DOM preload:

```sh
node --import ./test/dom.mjs --test --test-reporter=tap ./test/app.test.mjs
```

These tests do not need an HTTP server, timers, or a complete application. The pending fetch mock deliberately ignores cancellation so the final test verifies that a superseded startup cannot activate the feature. Failed preparation is handled by the caller through the rejected `start()` Promise. Tests for an application's chosen error presentation belong alongside that application's UI.

## Add browser checks where they matter

JSDOM verifies DOM changes, delegated events, public lifecycle outcomes, and cleanup. It cannot establish real layout, focus and caret behavior while typing, browser navigation, or accessibility quality. Add browser tests for those user interactions and run them against your built consumer bundle. Test the behavior your application promises, including the chosen renderer and data provider.

In your application, import your application setup first, then the real View and Application modules and test their promised public behavior with these patterns. See [local editing](local-editing.md), [retained refresh](retained-refresh.md), and [tooling](../tooling.md) for related contracts and checks.
