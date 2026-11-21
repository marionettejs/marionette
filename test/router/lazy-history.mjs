import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as defaultBundler from 'vite';
import { parseArgs } from 'node:util';
import { verifyLazyHistoryBrowsers, verifyLazyHistoryBrowserReport } from './lazy-history-browser.mjs';

const markers = {
  history: 'historyDriver requires a browser Window',
  memory: 'Cannot simulate navigationType',
  native: 'navigationDriver requires the Navigation API',
};

// Consume only installed public exports. Retain the complete production output,
// manifest, source maps and graph so downstream precache rules can identify assets.
export async function verifyLazyHistory(consumer, { baseline = false, browser = false, executablePath, engines, bundler = defaultBundler } = {}) {
  const directory = resolve(consumer, baseline ? 'router-lazy-root' : 'router-lazy-history');
  mkdirSync(directory, { recursive: true });
  writeFileSync(resolve(directory, 'index.html'), '<!doctype html><title>Router consumer</title><script type="module" src="/main.js"></script>');
  writeFileSync(resolve(directory, 'main.js'), `import { Router } from '@mnjs/router';
    async function start() {
      let hasNavigation = false;
      try { hasNavigation = Boolean(globalThis.navigation); } catch {}
      const fallback = !hasNavigation;
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
  if (browser) { report.browser = await verifyLazyHistoryBrowsers(directory, report, { engines, executablePath }); }
  writeFileSync(resolve(directory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  if (browser) { verifyLazyHistoryBrowserReport(report.browser, engines); }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    baseline: { type: 'boolean', default: false }, browser: { type: 'boolean', default: false },
    engine: { type: 'string', multiple: true },
  } });
  assert.equal(positionals.length, 1, 'Pass one installed consumer directory');
  assert.ok(!values.engine || values.browser, '--engine requires --browser');
  const report = await verifyLazyHistory(resolve(positionals[0]), {
    baseline: values.baseline, browser: values.browser, engines: values.engine,
    executablePath: process.env.MARIONETTE_ROUTER_CHROMIUM,
  });
  console.log(JSON.stringify(report, null, 2));
}
