import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { test, after, mock } from 'node:test';
import { JSDOM } from 'jsdom';

const markdown = await readFile(new URL('../../../docs/task-recipes.md', import.meta.url), 'utf8');
const marker = '<!-- executable-example: retryable-delete-screen -->';
assert.equal(markdown.split(marker).length - 1, 1);
const code = markdown.split(marker)[1].match(/^\s*```javascript\n([\s\S]*?)\n```/)[1];
await mkdir(new URL('./dist/', import.meta.url), { recursive: true });
const file = new URL('./dist/retryable-delete-screen.mjs', import.meta.url);
await writeFile(file, code);
const { DeleteApplication } = await import(file);
const { Application, View } = await import('marionette');
const dom = new JSDOM('<main></main>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
after(() => {
  dom.window.close();
  delete globalThis.document;
  delete globalThis.window;
});
const region = { el: document.querySelector('main') };
const record = { id: 'a', label: '<img src=screen>' };
const settle = () => new Promise(resolve => setImmediate(resolve));

test('duplicate submission is ignored; failed deletion retains the button for retry', async() => {
  const requests = [];
  const deleted = [];
  const screen = new DeleteApplication({ region, remove(id) {
    assert.equal(id, record.id);
    const request = Promise.withResolvers();
    requests.push(request);
    return request.promise;
  } });
  screen.on('deleted', value => deleted.push(value));
  try {
    await screen.start({ record });
    const view = screen.getView();
    const button = document.querySelector('button');
    assert.equal(document.querySelector('img'), null);
    assert.equal(document.querySelector('.label').textContent, record.label);
    const pending = screen.confirm();
    assert.equal(button.disabled, true);
    assert.equal(await screen.confirm(), false);
    assert.equal(requests.length, 1);
    requests[0].reject(new Error('<b>Retry</b>'));
    assert.equal(await pending, false);
    assert.equal(screen.getView(), view);
    assert.equal(document.querySelector('button'), button);
    assert.equal(button.disabled, false);
    assert.equal(document.querySelector('[role=alert]').textContent, '<b>Retry</b>');
    assert.equal(document.querySelector('b'), null);
    button.click();
    requests[1].resolve();
    await settle();
    assert.deepEqual(deleted, [record]);
    assert.equal(button.disabled, true);
    assert.equal(await screen.confirm(), false);
  } finally { await screen.destroy(); }
});

for (const boundary of ['parent stop', 'host replacement', 'destroy']) {
  for (const outcome of ['success', 'failure']) {
    test(`${boundary} suppresses late deletion ${outcome}`, async() => {
      const request = Promise.withResolvers();
      const parent = new Application();
      const screen = new DeleteApplication({ region, remove() { return request.promise; } });
      const deleted = [];
      parent.addChildApp('delete', screen);
      screen.on('deleted', value => deleted.push(value));
      try {
        await parent.start();
        await screen.start({ record });
        const pending = screen.confirm();
        if (boundary === 'parent stop') {await parent.stop();} else if (boundary === 'host replacement') {screen.getRegion().show(new View({ template: () => 'Replacement' }));} else {await parent.destroy();}
        if (outcome === 'success') {request.resolve();} else {request.reject(new Error('Late failure'));}
        assert.equal(await pending, false);
        assert.deepEqual(deleted, []);
        assert.equal(document.querySelector('main').textContent, boundary === 'host replacement' ? 'Replacement' : '');
        if (boundary === 'parent stop') {
          await parent.start();
          await screen.start({ record: { id: 'b', label: 'Another record' } });
          assert.equal(document.querySelector('button').disabled, false);
          assert.equal(document.querySelector('.label').textContent, 'Another record');
        }
      } finally { await parent.destroy(); }
    });
  }
}

test('unexpected completion errors reject awaited calls and are reported for clicks', async() => {
  const failure = new Error('Completion handler failed');
  const reported = [];
  const report = mock.method(console, 'error', error => reported.push(error));
  const screen = new DeleteApplication({ region, async remove() {} });
  screen.on('deleted', () => { throw failure; });
  try {
    await screen.start({ record });
    await assert.rejects(screen.confirm(), error => error === failure);
    assert.equal(await screen.confirm(), false);
    await screen.stop();
    await screen.start({ record });
    document.querySelector('button').click();
    await settle();
    assert.deepEqual(reported, [failure]);
  } finally {
    await screen.destroy();
    report.mock.restore();
  }
});
