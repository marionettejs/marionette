import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

// Router's independent Node floor must not silently raise core's Node 22 floor.
const [major, minor] = process.versions.node.split('.').map(Number);
assert(major > 24 || (major === 24 && minor >= 15), 'Router documentation check requires Node 24.15+');
assert(process.env.npm_execpath, 'Run npm run docs:check-router');
const root = resolve(import.meta.dirname, '../..');
// Published evidence versions are independent of unreleased source manifests.
const companions = JSON.parse(readFileSync(join(root, 'test/docs/companion-versions.json')));
const directory = join(root, 'test/tmp/router-docs');
mkdirSync(directory, { recursive: true });
writeFileSync(join(directory, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
const run = (file, args) => execFileSync(file, args, { cwd: directory, stdio: 'inherit', timeout: 180_000 });
run(process.execPath, [process.env.npm_execpath, 'install', '--ignore-scripts', '--no-audit', '--no-fund',
  ...Object.entries(companions).map(([name, version]) => `${name}@${version}`),
  'jsdom@30.1.0', 'typescript@6.0.3']);
for (const [name, version] of Object.entries(companions)) {
  const installed = JSON.parse(readFileSync(join(directory, 'node_modules', name, 'package.json')));
  assert.equal(installed.version, version, `${name} must match the recorded published evidence`);
}
for (const [name, paths] of [
  ['@mnjs/html', ['guide.md', 'LIT_DIFFERENCES.md']],
  ['@mnjs/router', ['readme.md', 'DESIGN.md', 'examples/catalog/catalog.mjs']],
]) {
  for (const path of paths) {
    assert(readFileSync(join(directory, 'node_modules', name, path), 'utf8').length, `${name}/${path}`);
  }
}
const markdown = readFileSync(join(root, 'docs/guides/routing.md'), 'utf8');
const fences = [...markdown.matchAll(/```js\n([\s\S]*?)```/g)];
assert.equal(fences.length, 1, 'Update the companion fixture for changed runnable examples');
writeFileSync(join(directory, 'app.mjs'), fences[0][1]);
writeFileSync(join(directory, 'catalog.mjs'), readFileSync(join(root, 'packages/router/examples/catalog/catalog.mjs'), 'utf8'));
writeFileSync(join(directory, 'check.mjs'), `
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<div id="app"></div>', { url: 'https://example.test/catalog/42' });
for (const name of ['window', 'document', 'Node', 'HTMLElement', 'CustomEvent']) globalThis[name] = dom.window[name];
const { memoryDriver } = await import('@mnjs/router');
const { createApp } = await import('./app.mjs');
const loads = [];
let releaseSlow;
let markSlowStarted;
const slowStarted = new Promise(resolve => { markSlowStarted = resolve; });
const slowResult = new Promise(resolve => { releaseSlow = resolve; });
const app = createApp({ driver: memoryDriver({ url: 'https://example.test/catalog/42' }),
  loadItem: async id => {
    loads.push(id);
    if (id === 'bad') throw new Error('load failed');
    if (id === 'slow') { markSlowStarted(); return slowResult; }
    return '<Item ' + id + '>';
  } });
assert.equal((await app.start()).status, 'matched');
assert.equal(document.querySelector('h1').textContent, '<Item 42>');
assert.equal(document.querySelector('item'), null);
const child = app.catalog.getCurrent();
assert.equal(await app.router.navigate('catalog:reviews', { id: '42' }).finished, true);
assert.equal(app.catalog.getCurrent(), child);
assert.deepEqual(loads, ['42']);
assert.equal(document.querySelector('h1').textContent, 'Reviews: <Item 42>');
assert.equal(await app.router.navigate('catalog:item', { id: '43' }).finished, true);
assert.equal(app.catalog.getCurrent(), child);
assert.deepEqual(loads, ['42', '43']);
assert.equal(document.querySelector('h1').textContent, '<Item 43>');
await assert.rejects(app.router.navigate('catalog:item', { id: 'bad' }).finished, /load failed/);
assert.equal(await app.router.navigate('catalog:item', { id: '42' }).finished, true);
const stale = app.router.navigate('catalog:item', { id: 'slow' });
await slowStarted;
const current = app.router.navigate('catalog:item', { id: '43' });
assert.equal(await current.finished, true);
releaseSlow('<Stale>');
assert.equal(await stale.finished, false);
assert.equal(document.querySelector('h1').textContent, '<Item 43>');
app.frame.destroy();
assert.equal(document.querySelector('h1'), null);
assert(app.router.isDestroyed());
assert(app.catalog.isDestroyed());
assert(child.isDestroyed());
const failed = createApp({ driver: memoryDriver({ url: 'https://example.test/catalog/bad' }),
  loadItem: async () => { throw new Error('initial failed'); } });
await assert.rejects(failed.start(), /initial failed/);
assert(failed.frame.isDestroyed());
assert(failed.router.isDestroyed());
for (const action of ['stop', 'destroy']) {
  const cancelled = createApp({ driver: memoryDriver({ url: 'https://example.test/catalog/42' }) });
  const pending = cancelled.start();
  cancelled.frame[action]();
  assert.deepEqual(await pending, { status: 'cancelled' });
  assert.equal(cancelled.router.isRunning(), false);
  assert.equal(cancelled.catalog.isRunning(), false);
  cancelled.frame.destroy();
}
for (const name of ['catalog', 'router']) {
  const cancelled = createApp({ driver: memoryDriver({ url: 'https://example.test/catalog/42' }) });
  cancelled[name].on('before:start', () => cancelled[name].stop());
  assert.deepEqual(await cancelled.start(), { status: 'cancelled' });
  assert(cancelled.frame.isDestroyed());
  assert(cancelled.catalog.isDestroyed());
  assert(cancelled.router.isDestroyed());
}
// Execute the revised source Catalog against the same published public packages.
const { Catalog: SourceCatalog } = await import('./catalog.mjs');
const { Router } = await import('@mnjs/router');
const sourceLoads = [];
const sourceRouter = new Router({ driver: memoryDriver({ url: 'https://example.test/catalog/42' }) });
const sourceCatalog = new SourceCatalog({ region: { el: '#app' },
  loadItem: async id => { sourceLoads.push(id); return '<img src=x> Item ' + id; } });
sourceCatalog.mountRoutes(sourceRouter);
await sourceCatalog.start(); await sourceRouter.start();
assert.equal((await sourceRouter.getInitialDispatch()).status, 'matched');
const sourceItem = sourceCatalog.getChildApp('item');
assert.equal(document.querySelector('h1').textContent, '<img src=x> Item 42');
assert.equal(document.querySelector('img'), null);
await sourceRouter.navigate('catalog:reviews').finished;
assert.deepEqual(sourceLoads, ['42']);
assert.equal(document.querySelector('h1').textContent, 'Reviews: <img src=x> Item 42');
await sourceRouter.navigate('catalog:item', { id: '43' }).finished;
assert.deepEqual(sourceLoads, ['42', '43']);
assert.equal(sourceCatalog.getChildApp('item'), sourceItem);
sourceCatalog.destroy(); sourceRouter.destroy();
assert(sourceItem.isDestroyed());
assert.equal(document.querySelector('h1'), null);
dom.window.close();
console.log('Published companion example: initial dispatch, escaping, retention, reload, failure recovery, cancellation and destruction passed.');
`);
run(process.execPath, ['check.mjs']);
writeFileSync(join(directory, 'consumer.mts'), `
import { Router, RouteApplication, memoryDriver, type ApplicationRoutes } from '@mnjs/router';
import { View } from 'marionette';
import { html } from '@mnjs/html';
import HtmlDomApi from '@mnjs/html/marionette';
const Page = View.extend({ template: () => html\`<h1>Catalog</h1>\` }).setDomApi(HtmlDomApi);
const routes: ApplicationRoutes = { '/catalog': { name: 'catalog', handler: 'showCatalog' } };
const Catalog = RouteApplication.extend({ routes, showCatalog() { this.showView(new Page()); } });
const feature = new Catalog({ region: { el: '#app' } });
const router = new Router({ driver: memoryDriver({ url: 'https://example.test/catalog' }) });
const unmount: () => void = feature.mountRoutes(router);
const outcome: Promise<boolean> = router.navigate('catalog').finished;
void outcome; unmount(); feature.destroy(); router.destroy();
`);
writeFileSync(join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
  target: 'ES2024', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, noEmit: true, skipLibCheck: false,
}, files: ['consumer.mts'] }));
run(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json']);
console.log('Published Router/HTML public-import TypeScript consumer passed. No browser certification claimed.');
