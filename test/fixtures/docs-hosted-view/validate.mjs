import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const markdown = await readFile(new URL('../../../docs/hosting-views.md', import.meta.url), 'utf8');
const marker = '<!-- executable-example: external-host-region -->';
assert.equal(markdown.split(marker).length - 1, 1);
const match = markdown.slice(markdown.indexOf(marker) + marker.length)
  .match(/^\s*```javascript\n([\s\S]*?)\n```/);
assert.ok(match, 'The host example must be an executable module');
await mkdir(new URL('./dist/', import.meta.url), { recursive: true });
const moduleUrl = new URL('./dist/host-screen.mjs', import.meta.url);
await writeFile(moduleUrl, match[1]);

const dom = new JSDOM('<!doctype html><main></main>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const host = document.querySelector('main');
const { mountScreen } = await import(moduleUrl.href);
const { View } = await import('marionette');
const { default: LitDomApi } = await import('@mnjs/adapters/dom/lit-html');
const { html } = await import('lit-html');
const { AsyncDirective } = await import('lit-html/async-directive.js');
const { directive } = await import('lit-html/directive.js');
const notifications = [];
class Resource extends AsyncDirective {
  render() { notifications.push(`render:${this.isConnected}`); return 'Child'; }
  reconnected() { notifications.push('connected'); }
  disconnected() { notifications.push('disconnected'); }
}
const resource = directive(Resource);
let clicks = 0;
const Child = View.extend({
  template: () => html`<button>${resource()}</button>`,
  events: { 'click button': () => clicks++ }
});
Child.setDomApi(LitDomApi);
const Screen = View.extend({
  template: () => '<section></section>',
  regions: { content: 'section' },
  onRender() { this.showChildView('content', new Child()); }
});
let mounted;
let unmanaged;
try {
  // Public reproduction of the consumer's raw-insertion boundary.
  unmanaged = new Child();
  unmanaged.render();
  host.replaceChildren(unmanaged.el);
  assert.equal(unmanaged.el.isConnected, true);
  assert.equal(unmanaged.isAttached(), false);
  assert.deepEqual(notifications, ['render:false']);
  unmanaged.destroy();
  notifications.length = 0;

  for (let cycle = 0; cycle < 2; cycle++) {
    mounted = mountScreen(host, Screen);
    const child = mounted.view.getChildView('content');
    assert.equal(mounted.view.isAttached(), true);
    assert.equal(child.isAttached(), true);
    assert.deepEqual(notifications, ['render:false', 'connected']);
    const button = child.el.querySelector('button');
    button.click();
    assert.equal(clicks, cycle + 1);
    mounted.destroy();
    mounted.destroy();
    assert.equal(mounted.view.isDestroyed(), true);
    assert.equal(child.isDestroyed(), true);
    assert.deepEqual(notifications, ['render:false', 'connected', 'disconnected']);
    button.click();
    assert.equal(clicks, cycle + 1, 'Destroyed child must not handle clicks');
    assert.equal(host.isConnected, true, 'Shell retains its host');
    assert.equal(host.childNodes.length, 0);
    notifications.length = 0;
  }
  console.log('Hosted View: raw insertion mismatch and managed Lit child cleanup passed');
} finally {
  mounted?.destroy();
  unmanaged?.destroy();
  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
}
