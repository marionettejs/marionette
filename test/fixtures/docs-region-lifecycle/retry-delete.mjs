import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test, after } from 'node:test';
import { JSDOM } from 'jsdom';
const fixtureDir = dirname(fileURLToPath(import.meta.url));
const markdown = await readFile(resolve(fixtureDir, '../../../docs/task-recipes.md'), 'utf8');
const marker = '<!-- executable-example: retryable-delete-screen -->';
assert.equal(markdown.split(marker).length - 1, 1);
const example = markdown.slice(markdown.indexOf(marker) + marker.length).match(/^\s*```javascript\n([\s\S]*?)\n```/);
assert.ok(example, 'the retryable-delete-screen marker must have a JavaScript fence');
await mkdir(resolve(fixtureDir, 'dist'), {
  recursive: true
});
const examplePath = resolve(fixtureDir, 'dist/retryable-delete-screen.mjs');
await writeFile(examplePath, example[1]);
const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const {
  createDeleteScreen
} = await import(pathToFileURL(examplePath));
const host = () => {
  const el = document.createElement('main');
  document.body.append(el);
  return el;
};
after(() => {
  dom.window.close();
  delete globalThis.document;
  delete globalThis.window;
});
for (const schedule of ['immediate', 'deferred']) {
  const subject = {
    createDeleteScreen(el, load, remove, navigate, reportError) {
      const invoke = fn => schedule === 'immediate' ? fn : id => Promise.resolve().then(() => fn(id));
      return createDeleteScreen(el, invoke(load), invoke(remove), navigate, reportError);
    }
  };
  const deferred = () => {
    let fulfill;
    let reject;
    const promise = new Promise((a, b) => {
      fulfill = a;
      reject = b;
    });
    return {
      promise,
      resolve: fulfill,
      reject
    };
  };
  const settleRequests = () => new Promise(r => setImmediate(r));
  test(`${schedule}: disabled load, duplicate submit, rejection keeps retry view, success once`, async() => {
    const el = host();
    const loading = deferred();
    const firstRemoval = deferred();
    const retryRemoval = deferred();
    let removes = 0;
    const nav = [];
    const screen = subject.createDeleteScreen(el, () => loading.promise, () => ++removes === 1 ? firstRemoval.promise : retryRemoval.promise, id => nav.push(id));
    const open = screen.open('a');
    const originalView = el.firstElementChild;
    const button = el.querySelector('button');
    assert.equal(button.disabled, true);
    assert.equal(await screen.confirm(), false);
    assert.equal(removes, 0);
    loading.resolve({
      label: '<img src=screen>'
    });
    assert.equal(await open, true);
    assert.equal(button.disabled, false);
    assert.equal(el.querySelector('img'), null);
    const confirmation = screen.confirm();
    assert.equal(await screen.confirm(), false);
    assert.equal(removes, 1);
    firstRemoval.reject(new Error('<b>retry</b>'));
    assert.equal(await confirmation, false);
    assert.equal(el.firstElementChild, originalView);
    assert.equal(el.querySelector('button'), button);
    assert.equal(button.disabled, false);
    assert.equal(el.querySelector('[role="alert"]').textContent, '<b>retry</b>');
    assert.equal(el.querySelector('b'), null);
    button.click();
    await settleRequests();
    assert.equal(removes, 2);
    retryRemoval.resolve();
    await settleRequests();
    assert.deepEqual(nav, ['a']);
    assert.equal(await screen.confirm(), false);
    screen.destroy();
    el.remove();
  });
  test(`${schedule}: stale loads and removals cannot affect replacement or closed screen`, async() => {
    const el = host();
    const loads = [];
    const removals = [];
    const nav = [];
    const screen = subject.createDeleteScreen(el, id => {
      const request = deferred();
      loads.push(request);
      return request.promise;
    }, id => {
      const request = deferred();
      removals.push(request);
      return request.promise;
    }, id => nav.push(id));
    const first = screen.open('a');
    await settleRequests();
    const second = screen.open('b');
    await settleRequests();
    loads[0].resolve({
      label: 'old'
    });
    assert.equal(await first, false);
    assert.equal(el.querySelector('button').disabled, true);
    loads[1].resolve({
      label: 'new'
    });
    assert.equal(await second, true);
    const removing = screen.confirm();
    await settleRequests();
    const third = screen.open('c');
    await settleRequests();
    removals[0].reject(new Error('stale'));
    assert.equal(await removing, false);
    assert.equal(el.querySelector('[role="alert"]').textContent, '');
    loads[2].resolve({
      label: 'C'
    });
    await third;
    const late = screen.confirm();
    await settleRequests();
    screen.close();
    removals[1].resolve();
    assert.equal(await late, false);
    assert.deepEqual(nav, []);
    assert.equal(await screen.confirm(), false);
    assert.equal(el.children.length, 0);
    const last = screen.open('request');
    await settleRequests();
    screen.destroy();
    loads[3].reject(new Error('late'));
    assert.equal(await last, false);
    assert.equal(await screen.open('e'), false);
    assert.equal(loads.length, 4);
    el.remove();
  });
  test(`${schedule}: load rejection reports error and later open recovers`, async() => {
    const el = host();
    let count = 0;
    const screen = subject.createDeleteScreen(el, async() => {
      if (!count++) {
        throw new Error('load failed');
      }
      return {
        label: 'ok'
      };
    }, async() => {}, () => {});
    assert.equal(await screen.open('a'), false);
    assert.equal(el.querySelector('[role="alert"]').textContent, 'load failed');
    assert.equal(el.querySelector('button').disabled, true);
    assert.equal(await screen.confirm(), false);
    assert.equal(await screen.open('b'), true);
    assert.equal(el.querySelector('[role="alert"]').textContent, '');
    screen.destroy();
    el.remove();
  });
}

test('unexpected navigation failures reject awaited calls and are reported on clicks', async() => {
  const el = host();
  const failure = new Error('navigation failed');
  const reported = [];
  let removes = 0;
  const screen = createDeleteScreen(el, async() => ({ label: 'A' }), async() => { removes++; }, () => { throw failure; }, error => reported.push(error));
  assert.deepEqual(Object.keys(screen).sort(), ['close', 'confirm', 'destroy', 'open']);
  await screen.open('a');
  await assert.rejects(screen.confirm(), error => error === failure);
  assert.deepEqual(reported, []);
  await screen.open('b');
  el.querySelector('button').click();
  await new Promise(done => setImmediate(done));
  assert.deepEqual(reported, [failure]);
  assert.equal(removes, 2);
  assert.equal(await screen.confirm(), false);
  screen.destroy();
  el.remove();
});
