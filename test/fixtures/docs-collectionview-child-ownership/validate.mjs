import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsPath = resolve(__dirname, '../../../docs/marionette.collectionview.md');
const marker = '<!-- executable-example: collectionview-child-ownership -->';
const markdown = await readFile(docsPath, 'utf8');

assert.equal(markdown.split(marker).length - 1, 1, 'expected one executable example marker');

const markedContent = markdown.slice(markdown.indexOf(marker) + marker.length);
const codeFence = markedContent.match(/^\s*```javascript\n([\s\S]*?)\n```/);

assert.ok(codeFence, 'expected a JavaScript fence immediately after the marker');

const distDir = resolve(__dirname, 'dist');
const examplePath = resolve(distDir, 'example.mjs');

await mkdir(distDir, { recursive: true });
await writeFile(examplePath, codeFence[1], 'utf8');

const dom = new JSDOM('<!doctype html><html><body></body></html>');

globalThis.window = dom.window;
globalThis.document = dom.window.document;

let collectionView;
let reusableChild;
let remainingChild;
let CollectionViewClass;
let originalAddChildView;
let originalCollectionViewDestroy;
let originalDetachChildView;
let originalRemoveChildView;
let methodsWrapped = false;

function restoreMethods() {
  if (!methodsWrapped) {
    return;
  }

  CollectionViewClass.prototype.addChildView = originalAddChildView;
  CollectionViewClass.prototype.detachChildView = originalDetachChildView;
  CollectionViewClass.prototype.removeChildView = originalRemoveChildView;
  CollectionViewClass.prototype.destroy = originalCollectionViewDestroy;
  methodsWrapped = false;
}

try {
  const example = await import(pathToFileURL(examplePath));
  ({ CollectionView: CollectionViewClass } = await import('marionette'));

  const renderCounts = new WeakMap();
  const destroyCounts = new WeakMap();
  const observedChildren = new WeakSet();
  let addCount = 0;
  let detachCount = 0;
  let detaching = false;
  let removeCount = 0;
  let ownerDestroyCount = 0;

  originalAddChildView = CollectionViewClass.prototype.addChildView;
  CollectionViewClass.prototype.addChildView = function(view, ...args) {
    if (addCount === 0) {
      collectionView = this;
      reusableChild = view;
      assert.equal(collectionView.children.hasView(view), false, 'the first child must start unowned');
      collectionView.on('destroy', () => {
        ownerDestroyCount += 1;
      });
    } else if (addCount === 1) {
      assert.equal(this, collectionView, 'the detached child must return to the same CollectionView');
      assert.equal(view, reusableChild, 'the example must re-add the detached child');
      assert.equal(collectionView.children.hasView(view), false, 'detach must release ownership before re-add');
      assert.equal(view.isDestroyed(), false, 'the detached child must remain live before re-add');
      assert.equal(renderCounts.get(view), 1, 'the detached child must already be rendered before re-add');
    } else {
      assert.equal(this, collectionView, 'the remaining child must use the same CollectionView');
      assert.notEqual(view, reusableChild, 'the final managed child must be a distinct View');
      remainingChild = view;
    }

    if (!observedChildren.has(view)) {
      observedChildren.add(view);
      view.on('render', () => {
        renderCounts.set(view, (renderCounts.get(view) || 0) + 1);
      });
      view.on('destroy', () => {
        destroyCounts.set(view, (destroyCounts.get(view) || 0) + 1);
      });
    }

    const result = originalAddChildView.call(this, view, ...args);
    addCount += 1;

    assert.equal(result, view, 'addChildView must return the added View');
    assert.equal(collectionView.children.hasView(view), true, 'addChildView must establish ownership');
    assert.equal(collectionView.el.contains(view.el), true, 'addChildView must place the child inside its owner');
    assert.equal(view.isDestroyed(), false, 'an added child must remain live');

    if (view === reusableChild) {
      assert.equal(renderCounts.get(view), 1, 're-adding a rendered child must not render it again');
    }

    return result;
  };

  originalDetachChildView = CollectionViewClass.prototype.detachChildView;
  CollectionViewClass.prototype.detachChildView = function(view, ...args) {
    assert.equal(this, collectionView, 'detachChildView must use the owning CollectionView');
    assert.equal(view, reusableChild, 'the example must detach the first child');
    assert.equal(collectionView.children.hasView(view), true, 'the child must be owned before detach');

    detaching = true;
    let result;
    try {
      result = originalDetachChildView.call(this, view, ...args);
    } finally {
      detaching = false;
    }
    detachCount += 1;

    assert.equal(result, reusableChild, 'detachChildView must return the same View');
    assert.equal(collectionView.children.hasView(view), false, 'detachChildView must release ownership');
    assert.equal(collectionView.el.contains(view.el), false, 'detachChildView must remove the child from its owner');
    assert.equal(view.isDestroyed(), false, 'detachChildView must leave the View live');
    assert.equal(view.isRendered(), true, 'detachChildView must preserve rendered state');

    return result;
  };

  originalRemoveChildView = CollectionViewClass.prototype.removeChildView;
  CollectionViewClass.prototype.removeChildView = function(view, ...args) {
    if (detaching) {
      return originalRemoveChildView.call(this, view, ...args);
    }

    assert.equal(this, collectionView, 'removeChildView must use the owning CollectionView');
    assert.equal(view, reusableChild, 'the example must remove the re-added child');
    assert.equal(collectionView.children.hasView(view), true, 'the child must be owned before removal');

    const result = originalRemoveChildView.call(this, view, ...args);
    removeCount += 1;

    assert.equal(result, reusableChild, 'removeChildView must return the removed View');
    assert.equal(collectionView.children.hasView(view), false, 'removeChildView must release ownership');
    assert.equal(collectionView.el.contains(view.el), false, 'removeChildView must remove the child from its owner');
    assert.equal(view.isDestroyed(), true, 'removeChildView must destroy the removed View');
    assert.equal(destroyCounts.get(view), 1, 'removeChildView must destroy the child once');

    return result;
  };

  originalCollectionViewDestroy = CollectionViewClass.prototype.destroy;
  CollectionViewClass.prototype.destroy = function(...args) {
    assert.equal(this, collectionView, 'the example must destroy its CollectionView');
    assert.equal(collectionView.children.hasView(remainingChild), true, 'the final child must remain owned until teardown');
    assert.equal(collectionView.el.contains(remainingChild.el), true, 'the final child must remain inside its owner until teardown');

    const result = originalCollectionViewDestroy.apply(this, args);

    assert.equal(result, collectionView, 'destroy must return the CollectionView');
    assert.equal(collectionView.isDestroyed(), true, 'destroy must tear down the CollectionView');
    assert.equal(collectionView.children.hasView(remainingChild), false, 'destroy must release the final child');
    assert.equal(collectionView.el.contains(remainingChild.el), false, 'destroy must remove the final child from its owner');
    assert.equal(remainingChild.isDestroyed(), true, 'destroy must clean up the final child');
    assert.equal(destroyCounts.get(remainingChild), 1, 'destroy must clean up the final child once');

    return result;
  };
  methodsWrapped = true;

  example.runChildOwnershipLifecycle();

  assert.equal(addCount, 3, 'the example must add, re-add, and add a final child');
  assert.equal(detachCount, 1, 'the example must detach one child');
  assert.equal(removeCount, 1, 'the example must remove one child');
  assert.equal(ownerDestroyCount, 1, 'the example must destroy its CollectionView once');
  assert.equal(renderCounts.get(reusableChild), 1, 'the reusable child must render once');
  assert.equal(renderCounts.get(remainingChild), 1, 'the final child must render once');
} finally {
  restoreMethods();
  if (reusableChild && !reusableChild.isDestroyed()) {
    reusableChild.destroy();
  }
  if (remainingChild && !remainingChild.isDestroyed()) {
    remainingChild.destroy();
  }
  if (collectionView && !collectionView.isDestroyed()) {
    collectionView.destroy();
  }
  dom.window.close();
  delete globalThis.document;
  delete globalThis.window;
}
