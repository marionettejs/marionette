import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rollup } from 'rollup';
import terser from '@rollup/plugin-terser';
import { JSDOM } from 'jsdom';

const markers = {
  memory: 'Cannot simulate navigationType',
  history: 'historyDriver requires a browser Window',
  native: 'navigationDriver requires the Navigation API',
};
const scenarios = [
  { name: 'memory-only', imports: 'memoryDriver', value: 'memoryDriver(options)', retained: ['memory'] },
  { name: 'history-only', imports: 'historyDriver', value: 'historyDriver(options)', retained: ['history'] },
  { name: 'native-only', imports: 'navigationDriver', value: 'navigationDriver(options)', retained: ['native'] },
  { name: 'router-native', imports: 'Router', value: 'new Router({ routes, ...options })', retained: ['native'] },
  { name: 'router-memory', imports: 'Router, memoryDriver', value: 'new Router({ routes, driver: memoryDriver(options) })', retained: ['native', 'memory'] },
  { name: 'router-history', imports: 'Router, historyDriver', value: 'new Router({ routes, driver: historyDriver(options) })', retained: ['native', 'history'] },
];

// Resolve the installed ESM exports, including their declared sideEffects flag,
// as a production consumer bundler does. No source aliases or internal imports.
export async function verifyDriverTreeShaking(consumer) {
  const directory = resolve(consumer, 'router-tree-shaking');
  mkdirSync(directory, { recursive: true });
  const packages = new Map(['@mnjs/router', 'marionette', '@mnjs/utils', '@mnjs/radio'].map(name => {
    const root = resolve(consumer, 'node_modules', name);
    const manifest = JSON.parse(readFileSync(resolve(root, 'package.json')));
    return [name, { id: resolve(root, manifest.exports['.'].import.default), moduleSideEffects: manifest.sideEffects !== false }];
  }));
  const report = [];
  for (const scenario of scenarios) {
    const entry = resolve(directory, `${scenario.name}-entry.mjs`);
    writeFileSync(entry, `import { ${scenario.imports} } from '@mnjs/router';
      const routes = { home: { path: '/' }, item: { path: '/items/:id' } };
      export const create = options => ${scenario.value};\n`);
    const bundle = await rollup({ input: entry, plugins: [
      { name: 'installed-package-exports', resolveId: name => packages.get(name) },
      terser({ ecma: 2024, compress: { passes: 2 }, mangle: true }),
    ] });
    let chunk;
    try { ({ output: [chunk] } = await bundle.generate({ format: 'es' })); } finally { await bundle.close(); }
    assert.deepEqual(chunk.imports, [], 'The optimized consumer must include its actual runtime dependencies');
    const implementations = Object.fromEntries(Object.entries(markers).map(([name, marker]) => [name, chunk.code.includes(marker)]));
    assert.deepEqual(Object.keys(implementations).filter(name => implementations[name]).sort(), [...scenario.retained].sort(),
      `${scenario.name}: unused driver implementation survived optimized bundling`);
    const file = resolve(directory, `${scenario.name}.mjs`);
    writeFileSync(file, chunk.code);
    const { create } = await import(pathToFileURL(file));
    if (scenario.name === 'native-only') {
      assert.throws(() => create(), /Navigation API/);
    } else if (scenario.name === 'router-native') {
      const router = create(); router.destroy();
    } else {
      const dom = new JSDOM('', { url: 'https://tree.example/' });
      const owner = new AbortController();
      const value = create(scenario.name.includes('history') ? { window: dom.window } : { url: 'https://tree.example/' });
      try {
        if (scenario.name.startsWith('router-')) {
          await value.start(); await value.getInitialDispatch();
          assert.equal(await value.navigate('item', { id: 7 }).finished, true);
          assert.equal(value.getCurrent().params.id, '7');
          value.destroy();
        } else {
          value.addEventListener('navigate', event => event.intercept(), { signal: owner.signal });
          assert.equal((await value.navigate('/items/7').finished).url, 'https://tree.example/items/7');
        }
      } finally { owner.abort(); dom.window.close(); }
    }
    report.push({ scenario: scenario.name, bytes: Buffer.byteLength(chunk.code), implementations,
      modules: Object.entries(chunk.modules).map(([id, details]) => ({
        id: id.startsWith(consumer) ? id.slice(consumer.length + 1) : id,
        renderedLength: details.renderedLength, renderedExports: details.renderedExports, removedExports: details.removedExports,
      })) });
  }
  writeFileSync(resolve(directory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(JSON.stringify(await verifyDriverTreeShaking(resolve(process.argv[2])), null, 2));
}
