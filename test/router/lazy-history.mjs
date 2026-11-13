import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as defaultBundler from 'vite';
import { chromium } from '@playwright/test';

const markers = {
  history: 'historyDriver requires a browser Window',
  memory: 'Cannot simulate navigationType',
  native: 'navigationDriver requires the Navigation API',
};

// Consume only installed public exports. Retain the complete production output,
// manifest, source maps and graph so downstream precache rules can identify assets.
export async function verifyLazyHistory(consumer, { baseline = false, browser = false, executablePath, bundler = defaultBundler } = {}) {
  const directory = resolve(consumer, baseline ? 'router-lazy-root' : 'router-lazy-history');
  mkdirSync(directory, { recursive: true });
  writeFileSync(resolve(directory, 'index.html'), '<!doctype html><title>Router consumer</title><script type="module" src="/main.js"></script>');
  writeFileSync(resolve(directory, 'main.js'), `import { Router } from '@mnjs/router';
    async function start() {
      const fallback = !globalThis.navigation;
      const driver = fallback ? (await import('${baseline ? './history.js' : '@mnjs/router/history'}')).historyDriver() : undefined;
      const router = new Router({ driver, routes: { '/': { name: 'home' }, '/items/:id': { name: 'item' } } });
      await router.start();
      const initial = await router.getInitialDispatch();
      if (initial.status !== 'matched') throw new Error('Initial dispatch failed');
      globalThis.routerConsumer = { router, fallback };
    }
    start().catch(error => { globalThis.routerConsumerError = error.stack; });\n`);
  if (baseline) { writeFileSync(resolve(directory, 'history.js'), 'export { historyDriver } from \'@mnjs/router\';\n'); }
  const result = await bundler.build({ configFile: false, root: directory, logLevel: 'warn',
    build: { manifest: true, sourcemap: true, outDir: 'dist', emptyOutDir: true } });
  const chunks = result.output.filter(item => item.type === 'chunk');
  const byFile = new Map(chunks.map(chunk => [chunk.fileName, chunk]));
  const closure = (files, found = new Set()) => {
    for (const file of files) {
      if (found.has(file)) { continue; }
      found.add(file);
      assert.ok(byFile.has(file), `External JS dependency ${file}`);
      closure(byFile.get(file).imports, found);
    }
    return found;
  };
  const entry = chunks.find(chunk => chunk.isEntry);
  assert.ok(entry);
  const eager = closure([entry.fileName]);
  const history = chunks.filter(chunk => chunk.code.includes(markers.history)).map(chunk => chunk.fileName);
  assert.equal(history.length, 1, 'Exactly one History implementation');
  const memory = chunks.filter(chunk => chunk.code.includes(markers.memory)).map(chunk => chunk.fileName);
  assert.deepEqual(memory, [], 'Unused memory implementation must be removed');
  assert.equal(history.some(file => eager.has(file)), baseline, 'History download boundary');
  const dynamic = [...new Set([...eager].flatMap(file => byFile.get(file).dynamicImports))];
  if (!baseline) { assert.ok(dynamic.length > 0, 'A real dynamic fallback must remain'); }
  const lazy = closure(dynamic);
  assert.ok(lazy.has(history[0]) || (baseline && eager.has(history[0])), 'Fallback reaches the History implementation');
  const exclusive = [...lazy].filter(file => !eager.has(file));
  const manifest = JSON.parse(readFileSync(resolve(directory, 'dist/.vite/manifest.json')));
  const report = { baseline, node: process.versions.node,
    vite: bundler.version,
    entry: entry.fileName, staticClosure: [...eager], dynamicRoots: dynamic,
    historyImplementation: history, historyExclusiveAssets: exclusive, memoryImplementation: memory,
    manifest, chunks: chunks.map(chunk => ({ file: chunk.fileName, bytes: Buffer.byteLength(chunk.code),
      imports: chunk.imports, dynamicImports: chunk.dynamicImports,
      implementations: Object.fromEntries(Object.entries(markers).map(([name, marker]) => [name, chunk.code.includes(marker)])),
      modules: Object.entries(chunk.modules).map(([id, details]) => ({
        id: id.startsWith(consumer) ? id.slice(consumer.length + 1) : id,
        renderedLength: details.renderedLength, renderedExports: details.renderedExports, removedExports: details.removedExports,
      })),
    })) };
  if (browser) {
    const server = createServer((request, response) => {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      if (pathname !== '/' && !/^\/assets\/[\w.-]+\.js$/.test(pathname)) { response.writeHead(404).end(); return; }
      response.setHeader('content-type', pathname.endsWith('.js') ? 'text/javascript' : 'text/html');
      response.end(readFileSync(resolve(directory, 'dist', pathname === '/' ? 'index.html' : pathname.slice(1))));
    });
    await new Promise(ready => server.listen(0, '127.0.0.1', ready));
    let engine;
    try {
      engine = await chromium.launch({ ...(executablePath ? { executablePath } : {}) });
      report.browser = { version: engine.version(), branches: [] };
      const origin = `http://127.0.0.1:${server.address().port}`;
      for (const fallback of [false, true]) {
        const context = await engine.newContext();
        try {
          if (fallback) { await context.addInitScript(() => Object.defineProperty(globalThis, 'navigation', { configurable: true, value: undefined })); }
          const page = await context.newPage();
          const requests = [];
          page.on('request', request => { if (request.url().endsWith('.js')) { requests.push(new URL(request.url()).pathname.slice(1)); } });
          await page.goto(origin);
          await page.waitForFunction(() => globalThis.routerConsumer || globalThis.routerConsumerError);
          assert.equal(await page.evaluate(() => globalThis.routerConsumerError), undefined);
          assert.equal(await page.evaluate(() => globalThis.routerConsumer.fallback), fallback);
          await page.evaluate(async() => {
            const { router } = globalThis.routerConsumer;
            if (!await router.navigate('item', { id: 7 }, { state: { tab: 'details' } }).finished) {throw new Error('Navigation canceled');}
            if (router.getCurrent().params.id !== '7' || router.getCurrent().state.tab !== 'details') {throw new Error('Wrong route/state');}
            if (!await router.back() || router.getCurrent().name !== 'home') {throw new Error('Back failed');}
            router.destroy();
          });
          assert.equal(history.some(file => requests.includes(file)), fallback || baseline);
          assert.deepEqual([...new Set(requests)].sort(), [...(fallback ? new Set([...eager, ...lazy]) : eager)].sort());
          report.browser.branches.push({ fallback, requests, initialDispatch: 'matched', navigationStateAndBack: 'passed' });
        } finally { await context.close(); }
      }
    } finally { await engine?.close(); await new Promise(closed => server.close(closed)); }
  }
  writeFileSync(resolve(directory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = await verifyLazyHistory(resolve(process.argv[2]), {
    baseline: process.argv.includes('--baseline'), browser: process.argv.includes('--browser'),
    executablePath: process.env.MARIONETTE_ROUTER_CHROMIUM,
  });
  console.log(JSON.stringify(report, null, 2));
}
