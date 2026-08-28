import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsPath = resolve(__dirname, '../../../docs/marionette.region.md');
const marker = '<!-- executable-example: region-lifecycle -->';
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
      <main id="content"></main>
    </body>
  </html>`);

globalThis.window = dom.window;
globalThis.document = dom.window.document;

let contentView;
let region;
let secondRegion;
let RegionClass;
let originalShow;
let originalDetachView;
let originalEmpty;
let methodsWrapped = false;

function restoreRegionMethods() {
  if (!methodsWrapped) {
    return;
  }

  RegionClass.prototype.show = originalShow;
  RegionClass.prototype.detachView = originalDetachView;
  RegionClass.prototype.empty = originalEmpty;
  methodsWrapped = false;
}

try {
  const example = await import(pathToFileURL(examplePath));
  ({ Region: RegionClass } = await import('marionette'));

  let renderCount = 0;
  let showCount = 0;
  originalShow = RegionClass.prototype.show;
  RegionClass.prototype.show = function(view, ...args) {
    if (showCount === 0) {
      region = this;
      contentView = view;

      assert.equal(region.hasView(), false, 'the Region must start empty');
      assert.equal(region.isDestroyed(), false, 'the Region must start alive');
      assert.equal(region.currentView, undefined, 'an empty Region must not have a current View');

      const render = contentView.render;
      contentView.render = function(...renderArgs) {
        renderCount += 1;
        return render.apply(this, renderArgs);
      };
    } else {
      assert.equal(this, region, 'the example must re-show through the same Region');
      assert.equal(region.hasView(), false, 'the second show must follow detachView');
    }

    const result = originalShow.call(this, view, ...args);
    showCount += 1;

    assert.equal(result, region, 'show must return the Region');
    assert.equal(region.hasView(), true, 'show must occupy the Region');
    assert.equal(region.currentView, contentView, 'show must set the current View');
    assert.equal(contentView.isDestroyed(), false, 'the shown View must remain alive');
    assert.equal(contentView.isRendered(), true, 'show must render the View');
    assert.equal(contentView.isAttached(), true, 'show must attach the View');
    assert.equal(renderCount, 1, 'show must leave the View rendered exactly once');

    return result;
  };

  let detachCount = 0;
  originalDetachView = RegionClass.prototype.detachView;
  RegionClass.prototype.detachView = function(...args) {
    assert.equal(this, region, 'detachView must use the shown Region');

    const detachedView = originalDetachView.apply(this, args);
    detachCount += 1;

    assert.equal(detachedView, contentView, 'detachView must return the current View');
    assert.equal(region.hasView(), false, 'detachView must empty the Region');
    assert.equal(region.currentView, undefined, 'detachView must clear the current View');
    assert.equal(detachedView.isDestroyed(), false, 'the detached View must stay alive');
    assert.equal(detachedView.isRendered(), true, 'the detached View must stay rendered');
    assert.equal(detachedView.isAttached(), false, 'the detached View must no longer be attached');

    return detachedView;
  };

  let occupiedEmptyCount = 0;
  originalEmpty = RegionClass.prototype.empty;
  RegionClass.prototype.empty = function(...args) {
    const emptiesContentView = region.currentView === contentView;
    const result = originalEmpty.apply(this, args);

    if (emptiesContentView) {
      occupiedEmptyCount += 1;
      assert.equal(result, region, 'empty must return the Region');
      assert.equal(region.hasView(), false, 'empty must leave the Region empty');
      assert.equal(region.currentView, undefined, 'empty must clear the current View');
      assert.equal(contentView.isDestroyed(), true, 'empty must destroy the current View');
    }

    return result;
  };
  methodsWrapped = true;

  const firstRegion = example.runRegionLifecycle();

  assert.equal(firstRegion, region, 'the example must return its Region');
  assert.equal(showCount, 2, 'the example must show and then re-show the View');
  assert.equal(detachCount, 1, 'the example must detach the View once');
  assert.equal(occupiedEmptyCount, 1, 'the example must empty its current View once');
  assert.equal(renderCount, 1, 'the complete lifecycle must render the View once');
  assert.equal(region.isDestroyed(), false, 'empty must not destroy the Region');

  restoreRegionMethods();

  secondRegion = example.runRegionLifecycle();

  assert.notEqual(secondRegion, region, 'each call must create a fresh Region');
  assert.equal(secondRegion.hasView(), false, 'the repeated lifecycle must finish empty');
  assert.equal(secondRegion.isDestroyed(), false, 'the repeated lifecycle must leave its Region alive');
} finally {
  restoreRegionMethods();
  if (contentView && !contentView.isDestroyed()) {
    contentView.destroy();
  }
  if (region && !region.isDestroyed()) {
    region.destroy();
  }
  if (secondRegion && !secondRegion.isDestroyed()) {
    secondRegion.destroy();
  }
  dom.window.close();
  delete globalThis.document;
  delete globalThis.window;
}
