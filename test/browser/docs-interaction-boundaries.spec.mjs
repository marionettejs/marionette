import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from './fixtures.mjs';

const markdown = await readFile(new URL('../../docs/dom.interactions.md', import.meta.url), 'utf8');
const code = markdown.match(/<!-- executable-example: native-hover-nested-click -->\n```javascript\n([\s\S]*?)\n```/)[1];

test('documented row handles actual hover boundaries and nested clicks', async({ page }) => {
  await page.evaluate(async source => {
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    try {
      const { RowView } = await import(url);
      const view = new RowView().render();
      window.rowExample = view;
      window.rowTrace = [];
      for (const name of ['enter', 'leave', 'save', 'open']) {
        view.on(`row:${name}`, () => window.rowTrace.push(name));
      }
      document.querySelector('#content').append(view.el);
    } finally { URL.revokeObjectURL(url); }
  }, code);
  await page.locator('.row > span').hover();
  await page.locator('.action span').hover();
  await page.locator('.action span').click();
  await page.locator('.row > span').click();
  await page.mouse.move(0, 0);
  assert.deepEqual(await page.evaluate(() => window.rowTrace), ['enter', 'save', 'open', 'leave']);
  await page.evaluate(() => window.rowExample.destroy());
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
