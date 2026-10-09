import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><main id="content"></main>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;

const { Region, View } = await import('marionette');
const template = document.createElement('template');
template.innerHTML = '<section><div class="child-region"></div></section>';
const root = template.content.firstElementChild;
const ParentView = View.extend({
  el: root,
  template: false,
  regions: { child: '.child-region' },
});
const parent = new ParentView();
const child = new View({ template: () => '<span>Child</span>' });
let parentAttach = 0;
let childAttach = 0;
parent.on('attach', () => { parentAttach += 1; });
child.on('attach', () => { childAttach += 1; });

try {
  assert.equal(root.ownerDocument.documentElement, null);
  assert.equal(parent.isAttached(), false);

  parent.showChildView('child', child);

  assert.equal(child.isAttached(), false);
  assert.equal(parentAttach, 0);
  assert.equal(childAttach, 0);

  const region = new Region({ el: '#content' });
  region.show(parent);

  assert.equal(parent.isAttached(), true);
  assert.equal(child.isAttached(), true);
  assert.equal(parentAttach, 1);
  assert.equal(childAttach, 1);

  region.destroy();
} finally {
  if (!parent.isDestroyed()) { parent.destroy(); }
  dom.window.close();
  delete globalThis.document;
  delete globalThis.window;
}
