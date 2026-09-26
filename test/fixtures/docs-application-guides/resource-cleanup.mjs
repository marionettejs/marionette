import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const markdown = await readFile(resolve(fixtureDir, '../../../docs/resource-cleanup.md'), 'utf8');
const output = resolve(fixtureDir, 'dist');
await mkdir(output, { recursive: true });

async function load(id, filename) {
  const marker = `<!-- executable-example: ${id} -->`;
  assert.equal(markdown.split(marker).length - 1, 1);
  const match = markdown.slice(markdown.indexOf(marker) + marker.length)
    .match(/^\s*```javascript\n([\s\S]*?)\n```/);
  assert.ok(match, `${id} must be a JavaScript module`);
  const path = resolve(output, filename);
  await writeFile(path, match[1]);
  return import(pathToFileURL(path));
}

const dom = new JSDOM('<!doctype html><main id="app"></main>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.MutationObserver = dom.window.MutationObserver;
const observers = [];
globalThis.ResizeObserver = class {
  constructor() {
    this.disconnects = 0;
    observers.push(this);
  }
  observe(element) { assert.equal(element.isConnected, true); }
  disconnect() { this.disconnects += 1; }
};
const messages = [];
const originalLog = console.log;
console.log = message => messages.push(message);

try {
  const [{ MeasuredView }, { EditorObserverView }, { StatusView }, { Events, Region }] = await Promise.all([
    load('root-resize-observer-cleanup', 'measured-view.mjs'),
    load('descendant-listener-cleanup', 'child-listener-view.mjs'),
    load('view-lifetime-cleanup', 'status-view.mjs'),
    import('marionette'),
  ]);
  const region = new Region({ el: document.querySelector('#app') });
  try {
    const measured = new MeasuredView();
    region.show(measured);
    assert.equal(observers.length, 1);
    for (let cycle = 0; cycle < 2; cycle += 1) {
      assert.equal(region.detachView(), measured);
      assert.equal(observers[cycle].disconnects, 1);
      region.show(measured);
      assert.equal(observers.length, cycle + 2);
    }
    region.show(new EditorObserverView());
    assert.deepEqual(observers.map(observer => observer.disconnects), [1, 1, 1]);

    const child = region.currentView;
    let changes = 0;
    child.on('editor:changed', () => changes++);
    const mutate = async element => {
      element.append(document.createElement('span'));
      await Promise.resolve();
    };
    const oldHost = child.getUI('editor')[0];
    await mutate(oldHost);
    assert.equal(changes, 1);
    child.render();
    await mutate(oldHost);
    assert.equal(changes, 1);
    const newHost = child.getUI('editor')[0];
    await mutate(newHost);
    assert.equal(changes, 2);
    assert.notEqual(oldHost, newHost);
    region.detachView();
    await mutate(newHost);
    assert.equal(changes, 2);
    region.show(child);
    await mutate(newHost);
    assert.equal(changes, 3);

    const source = Object.assign({}, Events);
    const status = new StatusView({ source });
    region.show(status);
    source.trigger('status:changed', 'ready');
    region.detachView();
    source.trigger('status:changed', 'detached');
    window.dispatchEvent(new window.Event('online'));
    assert.deepEqual(messages.slice(-3), ['ready', 'detached', 'online']);
    region.show(status);
    region.empty();
    source.trigger('status:changed', 'late');
    window.dispatchEvent(new window.Event('online'));
    assert.deepEqual(messages.slice(-3), ['ready', 'detached', 'online']);
  } finally {
    region.destroy();
  }
} finally {
  console.log = originalLog;
  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.ResizeObserver;
  delete globalThis.MutationObserver;
}
