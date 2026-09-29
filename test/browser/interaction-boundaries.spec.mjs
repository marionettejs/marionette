import assert from 'node:assert/strict';
import { test } from './fixtures.mjs';

test('Native View handles actual hover boundaries and nested clicks', async({ page }) => {
  await page.evaluate(async() => {
    const { View, Region } = await import('marionette');
    const Row = View.extend({
      template: () => '<div class="row"><span>Open</span><button class="action"><span>Save</span></button></div>',
      events: {
        'mouseover .row'(event) {
          if (!event.delegateTarget.contains(event.relatedTarget)) { this.trigger('row:enter'); }
        },
        'mouseout .row'(event) {
          if (!event.delegateTarget.contains(event.relatedTarget)) { this.trigger('row:leave'); }
        },
        'click .row'(event) {
          if (!event.target.closest('.action')) { this.trigger('row:open'); }
        },
        'click .action'() { this.trigger('row:save'); }
      }
    });
    const view = new Row();
    const region = new Region({ el: '#content' });
    window.rowTrace = [];
    for (const name of ['enter', 'leave', 'save', 'open']) {
      view.on(`row:${name}`, () => window.rowTrace.push(name));
    }
    region.show(view);
    window.rowFixture = { view, region };
  });
  await page.locator('.row > span').hover();
  await page.locator('.action span').hover();
  await page.locator('.action span').click();
  await page.locator('.row > span').click();
  const rowBox = await page.locator('.row').boundingBox();
  assert.ok(rowBox);
  await page.mouse.move(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height + 1);
  assert.deepEqual(await page.evaluate(() => window.rowTrace), ['enter', 'save', 'open', 'leave']);
  await page.evaluate(() => window.rowFixture.region.destroy());
});

test('Morphdom rerender can retain a loaded iframe and its browsing state', async({ page }) => {
  const result = await page.evaluate(async() => {
    const { createMarionette } = await import('marionette');
    const { default: Morphdom } = await import('@mnjs/adapters/dom/morphdom');
    const { View, Region } = createMarionette();
    const FrameView = View.extend({
      template: () => '<iframe id="preview" srcdoc="<p>Preview</p>"></iframe><span>Status</span>'
    });
    FrameView.setDomApi(Morphdom);
    const region = new Region({ el: document.querySelector('#content') });
    const view = new FrameView();
    view.render();
    const frame = view.el.querySelector('iframe');
    const loaded = new Promise(resolve => frame.addEventListener('load', resolve, { once: true }));
    region.show(view);
    await loaded;
    frame.contentWindow.retainedMarker = 'loaded';
    const documentBefore = frame.contentDocument;
    view.render();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const preserved = view.el.querySelector('iframe') === frame &&
      frame.contentDocument === documentBefore && frame.contentWindow.retainedMarker === 'loaded';
    const NativeView = View.extend({ template: () => '<iframe></iframe>' });
    const native = new NativeView().render();
    const original = native.el.querySelector('iframe');
    native.render();
    const replaced = original !== native.el.querySelector('iframe');
    native.destroy();
    region.destroy();
    return { preserved, replaced };
  });
  assert.deepEqual(result, { preserved: true, replaced: true });
});
