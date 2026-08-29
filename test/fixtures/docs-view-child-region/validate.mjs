import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsPath = resolve(__dirname, '../../../docs/marionette.view.md');
const marker = '<!-- executable-example: view-child-region -->';
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

let ViewClass;
let originalShowChildView;
let originalGetChildView;
let originalDetachChildView;
let methodsWrapped = false;
const runs = [];

function restoreViewMethods() {
  if (!methodsWrapped) {
    return;
  }

  ViewClass.prototype.showChildView = originalShowChildView;
  ViewClass.prototype.getChildView = originalGetChildView;
  ViewClass.prototype.detachChildView = originalDetachChildView;
  methodsWrapped = false;
}

function startRun(parentView, childView, regionName) {
  assert.equal(regionName, 'firstRegion', 'the lifecycle must start in firstRegion');
  assert.equal(parentView.isRendered(), false, 'the parent must start unrendered');
  assert.equal(parentView.isDestroyed(), false, 'the parent must start alive');
  assert.equal(childView.isRendered(), false, 'the child must start unrendered');
  assert.equal(childView.isDestroyed(), false, 'the child must start alive');

  const run = {
    parentView,
    childView,
    firstRegion: undefined,
    secondRegion: undefined,
    showCount: 0,
    getCount: 0,
    detachCount: 0,
    finished: false,
    childEvents: {
      beforeRender: 0,
      render: 0,
      beforeDestroy: 0,
      destroy: 0,
    },
    firstRegionEvents: { beforeEmpty: 0, empty: 0 },
    secondRegionEvents: { beforeEmpty: 0, empty: 0 },
  };

  childView.on({
    'before:render': () => { run.childEvents.beforeRender += 1; },
    render: () => { run.childEvents.render += 1; },
    'before:destroy': () => { run.childEvents.beforeDestroy += 1; },
    destroy: () => { run.childEvents.destroy += 1; },
  });

  runs.push(run);
  return run;
}

function currentRun() {
  return runs.at(-1);
}

function assertCompletedRun(run, returnedParent) {
  assert.equal(returnedParent, run.parentView, 'the example must return its parent View');
  assert.equal(run.finished, true, 'the lifecycle must empty secondRegion');
  assert.equal(run.showCount, 2, 'the lifecycle must show the child twice');
  assert.equal(run.getCount, 1, 'the lifecycle must access the child once');
  assert.equal(run.detachCount, 1, 'the lifecycle must detach the child once');
  assert.deepEqual(run.firstRegionEvents, { beforeEmpty: 1, empty: 1 }, 'detach must run one Region empty lifecycle');
  assert.deepEqual(run.secondRegionEvents, { beforeEmpty: 1, empty: 1 }, 'empty must run one Region empty lifecycle');
  assert.deepEqual(run.childEvents, {
    beforeRender: 1,
    render: 1,
    beforeDestroy: 1,
    destroy: 1,
  }, 'the child must render and destroy exactly once');
  assert.equal(run.firstRegion.hasView(), false, 'detach must leave firstRegion empty');
  assert.equal(run.firstRegion.currentView, undefined, 'detach must clear firstRegion ownership');
  assert.equal(run.secondRegion.hasView(), false, 'empty must leave secondRegion empty');
  assert.equal(run.secondRegion.currentView, undefined, 'empty must clear secondRegion ownership');
  assert.equal(run.parentView.el.contains(run.childView.el), false, 'empty must remove the child DOM');
  assert.equal(run.childView.isDestroyed(), true, 'empty must destroy the child');
  assert.equal(run.parentView.isDestroyed(), false, 'empty must leave the parent alive');
}

try {
  const example = await import(pathToFileURL(examplePath));
  ({ View: ViewClass } = await import('marionette'));

  originalShowChildView = ViewClass.prototype.showChildView;
  ViewClass.prototype.showChildView = function(regionName, childView, ...args) {
    let run = currentRun();
    if (!run || run.finished) {
      run = startRun(this, childView, regionName);
    } else {
      assert.equal(this, run.parentView, 'both shows must use the same parent View');
      assert.equal(regionName, 'secondRegion', 'the second show must use secondRegion');
      assert.equal(childView, run.childView, 'the second show must reuse the same child View');
      assert.equal(run.firstRegion.hasView(), false, 'the first Region must be empty before re-show');
      assert.equal(run.firstRegion.currentView, undefined, 'the first Region must release the child');
      assert.equal(run.childView.isRendered(), true, 'the detached child must stay rendered');
      assert.equal(run.childView.isDestroyed(), false, 'the detached child must stay alive');
      assert.equal(run.parentView.el.contains(run.childView.el), false, 'detach must remove the child DOM');

      run.secondRegion = this.getRegion('secondRegion');
      run.secondRegion.on({
        'before:empty': () => { run.secondRegionEvents.beforeEmpty += 1; },
        empty: () => {
          run.secondRegionEvents.empty += 1;
          run.finished = true;
        },
      });
    }

    const result = originalShowChildView.call(this, regionName, childView, ...args);
    run.showCount += 1;

    assert.equal(result, run.childView, 'showChildView must return the shown child');
    assert.equal(run.parentView.isRendered(), true, 'showChildView must render the parent');
    assert.equal(run.childView.isRendered(), true, 'showChildView must render the child');
    assert.equal(run.childView.isDestroyed(), false, 'the shown child must remain alive');
    assert.equal(run.childEvents.beforeRender, 1, 'the child must begin rendering once');
    assert.equal(run.childEvents.render, 1, 'the child must render once');

    if (regionName === 'firstRegion') {
      run.firstRegion = this.getRegion('firstRegion');
      run.firstRegion.on({
        'before:empty': () => { run.firstRegionEvents.beforeEmpty += 1; },
        empty: () => { run.firstRegionEvents.empty += 1; },
      });

      assert.equal(run.firstRegion.currentView, run.childView, 'firstRegion must own the child');
      assert.equal(run.firstRegion.el.contains(run.childView.el), true, 'firstRegion must contain the child DOM');
    } else {
      assert.equal(run.secondRegion.currentView, run.childView, 'secondRegion must own the re-shown child');
      assert.equal(run.secondRegion.el.contains(run.childView.el), true, 'secondRegion must contain the child DOM');
    }

    return result;
  };

  originalGetChildView = ViewClass.prototype.getChildView;
  ViewClass.prototype.getChildView = function(regionName, ...args) {
    const run = currentRun();
    const childView = originalGetChildView.call(this, regionName, ...args);

    assert.equal(this, run.parentView, 'getChildView must use the parent View');
    assert.equal(regionName, 'firstRegion', 'the example must access firstRegion');
    assert.equal(childView, run.childView, 'getChildView must return the exact shown child');
    run.getCount += 1;

    return childView;
  };

  originalDetachChildView = ViewClass.prototype.detachChildView;
  ViewClass.prototype.detachChildView = function(regionName, ...args) {
    const run = currentRun();

    assert.equal(this, run.parentView, 'detachChildView must use the parent View');
    assert.equal(regionName, 'firstRegion', 'the example must detach firstRegion');

    const childView = originalDetachChildView.call(this, regionName, ...args);
    run.detachCount += 1;

    assert.equal(childView, run.childView, 'detachChildView must return the exact shown child');
    assert.equal(run.firstRegion.hasView(), false, 'detachChildView must empty firstRegion');
    assert.equal(run.firstRegion.currentView, undefined, 'detachChildView must clear firstRegion ownership');
    assert.equal(run.firstRegion.el.contains(run.childView.el), false, 'detachChildView must remove the child DOM');
    assert.equal(run.childView.isRendered(), true, 'detachChildView must keep the child rendered');
    assert.equal(run.childView.isDestroyed(), false, 'detachChildView must keep the child alive');
    assert.deepEqual(run.firstRegionEvents, { beforeEmpty: 1, empty: 1 }, 'detach must run one Region empty lifecycle');

    return childView;
  };
  methodsWrapped = true;

  const firstParent = example.runViewChildRegionLifecycle();
  const firstRun = runs[0];

  assertCompletedRun(firstRun, firstParent);

  const secondParent = example.runViewChildRegionLifecycle();
  const secondRun = runs[1];

  assert.equal(secondParent, secondRun.parentView, 'the repeated example must return its parent View');
  assert.notEqual(secondRun.parentView, firstRun.parentView, 'each run must create a fresh parent View');
  assert.notEqual(secondRun.childView, firstRun.childView, 'each run must create a fresh child View');
  assert.notEqual(secondRun.firstRegion, firstRun.firstRegion, 'each run must create a fresh first Region');
  assert.notEqual(secondRun.secondRegion, firstRun.secondRegion, 'each run must create a fresh second Region');
  assertCompletedRun(secondRun, secondParent);

  restoreViewMethods();

  for (const run of runs) {
    run.parentView.destroy();
    assert.equal(run.parentView.isDestroyed(), true, 'fixture cleanup must destroy each parent View');
  }
} finally {
  restoreViewMethods();
  for (const run of runs) {
    if (!run.parentView.isDestroyed()) {
      run.parentView.destroy();
    }
    if (!run.childView.isDestroyed()) {
      run.childView.destroy();
    }
  }
  dom.window.close();
  delete globalThis.document;
  delete globalThis.window;
}
