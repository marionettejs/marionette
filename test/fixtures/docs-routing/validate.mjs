import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const marker = '<!-- executable-example: routing-latest-navigation -->';
const markdown = await readFile(resolve(fixtureDir, '../../../docs/routing.md'), 'utf8');
assert.equal(markdown.split(marker).length - 1, 1);
const code = markdown.slice(markdown.indexOf(marker) + marker.length)
  .match(/^\s*```javascript\n([\s\S]*?)\n```/);
assert.ok(code, 'the routing example must be a JavaScript module');
await mkdir(resolve(fixtureDir, 'dist'), { recursive: true });
const examplePath = resolve(fixtureDir, 'dist/page-navigation.mjs');
await writeFile(examplePath, code[1]);
const bootstrapMarker = '<!-- executable-example: application-bootstrap-readiness -->';
const bootstrapMarkdown = await readFile(resolve(fixtureDir, '../../../docs/marionette.application.md'), 'utf8');
assert.equal(bootstrapMarkdown.split(bootstrapMarker).length - 1, 1);
const bootstrapCode = bootstrapMarkdown.slice(bootstrapMarkdown.indexOf(bootstrapMarker) + bootstrapMarker.length)
  .match(/^\s*```javascript\n([\s\S]*?)\n```/);
assert.ok(bootstrapCode, 'the bootstrap example must be a JavaScript module');
const bootstrapPath = resolve(fixtureDir, 'dist/application-bootstrap.mjs');
await writeFile(bootstrapPath, bootstrapCode[1]);

const dom = new JSDOM('<!doctype html><main id="page"></main>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const requests = new Map();
const page = title => ({ title, body: `Body of ${title}` });
let application;
let bootstrap;

try {
  const { createPageNavigation } = await import(pathToFileURL(examplePath));
  const feature = await createPageNavigation({
    el: document.querySelector('#page'),
    loadPage(id, { signal }) {
      // Intentionally ignores abort: the controller must reject stale commits itself.
      const request = { signal, ...Promise.withResolvers() };
      requests.set(id, request);
      return request.promise;
    }
  });
  application = feature.application;
  const { navigate } = feature;
  assert.equal(application.isRunning(), true);

  const first = navigate('first');
  requests.get('first').resolve(page('First'));
  assert.equal(await first, true);
  const firstView = application.getView();
  assert.equal(document.querySelector('h1').textContent, 'First');

  const slow = navigate('slow');
  const fast = navigate('fast');
  assert.equal(requests.get('slow').signal.aborted, true);
  assert.equal(application.getView(), firstView, 'loading retains the previous page');
  requests.get('fast').resolve(page('Fast'));
  assert.equal(await fast, true);
  assert.equal(firstView.isDestroyed(), true, 'Region replacement destroys the previous page');
  const fastView = application.getView();
  requests.get('slow').resolve(page('Stale'));
  assert.equal(await slow, false);
  assert.equal(application.getView(), fastView, 'a late response cannot replace the current page');
  assert.equal(document.querySelector('h1').textContent, 'Fast');

  const old = navigate('old');
  const middle = navigate('middle');
  requests.get('old').reject(new Error('Old load failed'));
  assert.equal(await old, false, 'a stale rejection is cancellation');
  const newest = navigate('newest');
  assert.equal(requests.get('middle').signal.aborted, true,
    'the stale finally block must not discard the current cancellation handle');
  requests.get('middle').resolve(page('Middle'));
  requests.get('newest').resolve(page('Newest'));
  assert.equal(await middle, false);
  assert.equal(await newest, true);

  const failed = navigate('failed');
  const loadError = new Error('Current load failed');
  requests.get('failed').reject(loadError);
  await assert.rejects(failed, error => error === loadError);
  assert.equal(document.querySelector('h1').textContent, 'Newest',
    'a failed load retains the previous page');

  const pendingStop = navigate('pending-stop');
  const displayed = application.getView();
  assert.equal(await application.stop(), true);
  assert.equal(requests.get('pending-stop').signal.aborted, true);
  assert.equal(displayed.isDestroyed(), true);
  requests.get('pending-stop').resolve(page('Stopped'));
  assert.equal(await pendingStop, false);
  assert.equal(document.querySelector('#page').children.length, 0);
  assert.equal(await navigate('while-stopped'), false);
  assert.equal(requests.has('while-stopped'), false, 'stopped features do not load');

  assert.equal(await application.start(), true);
  const resumed = navigate('resumed');
  requests.get('resumed').resolve(page('<b>Literal title</b>'));
  assert.equal(await resumed, true, 'a stopped feature can resume navigation');
  assert.equal(document.querySelector('h1').textContent, '<b>Literal title</b>');
  assert.equal(document.querySelector('h1 b'), null, 'page data is text, not markup');

  const pendingDestroy = navigate('pending-destroy');
  const resumedView = application.getView();
  assert.equal(await application.destroy(), true);
  assert.equal(requests.get('pending-destroy').signal.aborted, true);
  requests.get('pending-destroy').reject(new Error('Late failure after destroy'));
  assert.equal(await pendingDestroy, false);
  assert.equal(resumedView.isDestroyed(), true);
  assert.equal(document.querySelector('#page').children.length, 0);
  assert.equal(await navigate('after-destroy'), false);
  assert.equal(requests.has('after-destroy'), false);
  const { createSessionApplication } = await import(pathToFileURL(bootstrapPath));
  const sessions = [];
  bootstrap = createSessionApplication({
    el: document.querySelector('#page'),
    loadSession({ signal }) {
      const request = { signal, ...Promise.withResolvers() };
      sessions.push(request);
      return request.promise;
    }
  });
  const canceledStart = bootstrap.start();
  assert.equal(bootstrap.isRunning(), false, 'the feature waits for startup data');
  assert.equal(await bootstrap.stop(), true);
  assert.equal(await canceledStart, false);
  assert.equal(sessions[0].signal.aborted, true);
  const currentStart = bootstrap.start();
  sessions[1].resolve({ name: 'Current session' });
  assert.equal(await currentStart, true);
  sessions[0].resolve({ name: 'Stale session' });
  await Promise.resolve();
  assert.equal(bootstrap.session.name, 'Current session', 'canceled startup cannot commit state');
  assert.equal(document.querySelector('h1').textContent, 'Current session');
  assert.equal(await bootstrap.stop(), true);
  const failedStart = bootstrap.start();
  sessions[2].reject(new Error('Session unavailable'));
  await assert.rejects(failedStart, /Session unavailable/);
  assert.equal(bootstrap.isRunning(), false);
  assert.equal(document.querySelector('#page').children.length, 0);
  console.log('Routing and bootstrap examples passed: replacement, stale results/errors, readiness, failure, stop/restart, destruction.');
} finally {
  if (bootstrap && !bootstrap.isDestroyed()) {
    await bootstrap.destroy();
  }
  if (application && !application.isDestroyed()) {
    await application.destroy();
  }
  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
}
