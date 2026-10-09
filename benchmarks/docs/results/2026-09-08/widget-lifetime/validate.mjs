import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><div id="region"></div>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const { Region, View } = await import('marionette');
const { createWidgetView } = await import('./solution.mjs');

const instances = [];
const view = createWidgetView(element => {
  assert.equal(element.isConnected, true, 'mount occurs while connected');
  const instance = { element, destroys: 0 };
  element.textContent = 'widget content';
  instances.push(instance);
  return {
    destroy() {
      assert.equal(element.isConnected, true, 'cleanup precedes removal');
      assert.equal(element.textContent, 'widget content', 'cleanup precedes content replacement');
      assert.equal(++instance.destroys, 1, 'exactly one cleanup per instance');
    },
  };
});
assert.ok(view instanceof View);
const region = new Region({ el: document.querySelector('#region') });
view.render();
view.render();
assert.equal(instances.length, 0, 'detached render does not mount');
region.show(view);
assert.equal(instances.length, 1);
region.show(view);
assert.equal(instances.length, 1, 'showing current view is a no-op');
view.render();
assert.equal(instances[0].destroys, 1);
assert.equal(instances[0].element.isConnected, false);
assert.equal(instances.length, 2);
assert.notEqual(instances[0].element, instances[1].element);
assert.equal(region.detachView(), view);
assert.equal(instances[1].destroys, 1);
assert.equal(view.isDestroyed(), false);
assert.equal(region.detachView(), undefined);
region.show(view);
assert.equal(instances.length, 3, 'reshow mounts without needing another render');
assert.equal(instances[1].element, instances[2].element, 'reshow preserves rendered host');
view.destroy();
view.destroy();
view.render();
assert.equal(instances.length, 3);
assert.deepEqual(instances.map(instance => instance.destroys), [1, 1, 1]);

const detachedView = createWidgetView(() => { throw new Error('must not mount'); });
detachedView.render();
detachedView.destroy();
region.destroy();
dom.window.close();
console.log('PASS: detached rendering, show, repeated show, attached rerender, detach, re-show, attached destroy, repeated destroy, detached destroy');
