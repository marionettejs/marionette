import assert from 'node:assert/strict';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const sourceRoot = process.argv[2];
assert.ok(sourceRoot, 'Pass the source checkout path');
const sourceUrl = path => pathToFileURL(resolve(sourceRoot, path)).href;
const require = createRequire(sourceUrl('package.json'));
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body><main id="app"></main></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const aliases = new Map([
  ['@mnjs/utils', sourceUrl('packages/utils/src/index.ts')],
  ['@mnjs/radio', sourceUrl('packages/radio/src/index.ts')],
]);
registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(aliases.get(specifier) || specifier, context);
  },
});
const { Application, View } = await import(sourceUrl('src/index.ts'));
const Layout = View.extend({
  template: () => '<header>Work queue</header><section class="results"></section>',
  regions: { results: '.results' },
});
const host = document.querySelector('#app');
let ready = Promise.withResolvers();
let childSignal;
let parentSignal;
let starts = 0;
let childStarts = 0;
const child = new (Application.extend({
  onBeforeStart() {
    this.showView(new View({ template: () => '<p>Loading results</p>' }));
  },
  prepareStart(options, { signal }) {
    childSignal = signal;
    return ready.promise;
  },
  onStart() { childStarts += 1; },
}))();
const parent = new (Application.extend({
  onBeforeStart() {
    const layout = this.setView(new Layout());
    layout.render();
    this.showView();
  },
  async prepareStart(options, { signal }) {
    parentSignal = signal;
    const started = await this.getChildApp('results').start({
      region: this.getView().getRegion('results'),
    });
    signal.throwIfAborted();
    if (!started) { throw new Error('Required results feature did not start'); }
  },
  onStart() { starts += 1; },
}))({ region: { el: host } });
parent.addChildApp('results', child);

try {
  const starting = parent.start();
  const firstLayout = parent.getView();
  assert.equal(firstLayout.el.isConnected, true, 'Shell mounts before child preparation completes');
  assert.equal(child.getRegion(), firstLayout.getRegion('results'));
  assert.equal(child.getView().el.isConnected, true, 'Child loading root is visible during preparation');
  assert.equal(parent.isRunning(), false);
  assert.equal(child.isRunning(), false);
  assert.equal(starts, 0);
  ready.resolve();
  assert.equal(await starting, true);
  assert.equal(parent.isRunning(), true);
  assert.equal(child.isRunning(), true);
  assert.equal(starts, 1);
  assert.equal(childStarts, 1);
  assert.equal(await parent.stop(), true);
  assert.equal(firstLayout.isDestroyed(), true);
  assert.equal(host.childElementCount, 0);
  console.log('PASS: visible parent shell and child loading root precede readiness; explicit child start receives its Region and both Applications activate.');

  ready = Promise.withResolvers();
  const canceledStart = parent.start();
  const canceledLayout = parent.getView();
  const canceledChildRoot = child.getView();
  assert.notEqual(canceledLayout, firstLayout);
  assert.equal(child.getRegion(), canceledLayout.getRegion('results'));
  assert.equal(canceledLayout.el.isConnected, true);
  assert.equal(await parent.stop(), true);
  assert.equal(await canceledStart, false);
  assert.equal(parentSignal.aborted, true);
  assert.equal(childSignal.aborted, true);
  assert.equal(canceledLayout.isDestroyed(), true);
  assert.equal(canceledChildRoot.isDestroyed(), true);
  ready.resolve();
  await ready.promise;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(parent.isRunning(), false);
  assert.equal(child.isRunning(), false);
  assert.equal(parent.getView(), undefined);
  assert.equal(child.getView(), undefined);
  assert.equal(host.childElementCount, 0);
  assert.equal(starts, 1);
  assert.equal(childStarts, 1);
  console.log('PASS: parent stop cancels pending parent/child startup; delayed completion cannot reactivate either Application or leave roots mounted.');

  ready = Promise.withResolvers();
  const requiredStart = parent.start();
  const requiredFailure = assert.rejects(requiredStart, /Required results feature did not start/);
  assert.equal(await child.stop(), true);
  await requiredFailure;
  assert.equal(parentSignal.aborted, false, 'Parent readiness was current when the required child canceled');
  assert.equal(parent.isRunning(), false);
  assert.equal(child.isRunning(), false);
  // Failed readiness is not an automatic rollback of the already displayed shell.
  assert.equal(parent.getView().el.isConnected, true);
  assert.equal(await parent.stop(), true);
  ready.resolve();
  await ready.promise;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(host.childElementCount, 0);
  console.log('PASS: explicit required-child false check rejects current parent readiness; caller stop cleans the already displayed shell.');

  let received;
  const falseResult = new (Application.extend({
    prepareStart() { return false; },
    onStart(application, options, result) { received = result; },
  }))();
  try {
    assert.equal(await falseResult.start(), true);
    assert.equal(falseResult.isRunning(), true);
    assert.equal(received, false);
    console.log('PASS: prepareStart returning false activates normally and forwards false to onStart; false is result data, not a readiness veto.');
  } finally {
    await falseResult.destroy();
  }
} finally {
  ready.resolve();
  await parent.destroy();
  dom.window.close();
}
