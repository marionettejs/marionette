import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const [renderer, format, jsdomPath] = process.argv.slice(2);
const require = createRequire(import.meta.url);
const { JSDOM } = await import(pathToFileURL(jsdomPath).href);
const dom = new JSDOM('<!doctype html><body><main></main></body>');
for (const name of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'Document', 'DocumentFragment']) {
  globalThis[name] = name === 'window' ? dom.window : dom.window[name];
}

try {
  for (const peer of ['backbone', 'jquery', 'redux', 'zustand', 'xstate', '@xstate/store',
    renderer === 'lit-html' ? 'morphdom' : 'lit-html']) {
    assert.throws(() => require.resolve(peer), { code: 'MODULE_NOT_FOUND' }, `${peer} leaked into fixture`);
  }

  const { View, Region } = format === 'esm' ? await import('marionette') : require('marionette');
  const specifier = `@marionette/adapters/render/${renderer}`;
  const install = format === 'esm' ? (await import(specifier)).default : require(specifier);
  assert.equal(typeof install, 'function', `${format} adapter did not export its installer directly`);

  const log = [];
  let value = 'first';
  let template = () => `<button id="survivor">${value}</button>`;
  if (renderer === 'lit-html') {
    const { html } = await import('lit-html');
    const { AsyncDirective } = await import('lit-html/async-directive.js');
    const { directive } = await import('lit-html/directive.js');
    class Resource extends AsyncDirective {
      render(text) { return text; }
      reconnected() { log.push('connected'); }
      disconnected() { log.push('disconnected'); }
    }
    const resource = directive(Resource);
    template = () => html`<button id="survivor">${resource(value)}</button>`;
  }

  let clicks = 0;
  const RenderedView = View.extend({ template, events: { 'click button': () => clicks++ } });
  const Dom = RenderedView.prototype.Dom;
  assert.equal(install(RenderedView), RenderedView);
  for (const key of Object.keys(Dom)) {
    if (key !== 'setContents' && key !== 'disposeContents') {
      assert.equal(RenderedView.prototype.Dom[key], Dom[key], 'Installer replaced an unrelated DOM operation');
    }
  }
  const view = new RenderedView();
  const region = new Region({ el: document.querySelector('main') });
  view.render();
  region.show(view);
  const root = view.el;
  const button = root.querySelector('button');
  value = 'second';
  assert.equal(view.render(), view);
  assert.equal(view.el, root);
  assert.equal(root.querySelector('button'), button);
  assert.equal(button.textContent, 'second');
  button.click();
  assert.equal(clicks, 1);
  region.detachView();
  region.show(view);
  region.destroy();
  assert.equal(view.isDestroyed(), true);
  assert.equal(root.isConnected, false);
  if (renderer === 'lit-html') {
    assert.deepEqual(log, ['connected', 'disconnected', 'connected', 'disconnected']);
    assert.equal(root.childNodes.length, 0);
  }
  console.log(`Validated isolated ${renderer} ${format} package`);
} finally {
  dom.window.close();
}
