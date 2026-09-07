import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer, request } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from '@playwright/test';
import { rollup } from 'rollup';

const root = resolve(import.meta.dirname, '../..');
const litRoot = dirname(fileURLToPath(import.meta.resolve('lit-html')));
const morphdom = resolve(dirname(fileURLToPath(import.meta.resolve('morphdom'))), 'morphdom-esm.js');
const jquery = resolve(dirname(fileURLToPath(import.meta.resolve('jquery'))), '../jquery.module.js');
const bundle = await rollup({
  input: resolve(root, 'test/contracts/dom-adapters.js'),
  external: id => id === 'lit-html' || id.startsWith('lit-html/') || id === 'morphdom' || id === 'jquery',
  plugins: [{
    name: 'distribution-contracts',
    resolveId(source) {
      const entries = {
        '@marionette/utils': 'packages/utils/dist/index.js',
        '../../src/index.ts': 'dist/marionette.js',
        '../../packages/adapters/src/dom/morphdom.ts': 'packages/adapters/dist/dom/morphdom.js',
        '../../packages/adapters/src/dom/lit-html.ts': 'packages/adapters/dist/dom/lit-html.js',
        '../../packages/adapters/src/dom/jquery.ts': 'packages/adapters/dist/dom/jquery.js',
      };
      if (entries[source]) { return resolve(root, entries[source]); }
    }
  }]
});
const { output } = await bundle.generate({ format: 'es' });
await bundle.close();

const litFiles = new Map(['lit-html.js', 'async-directive.js', 'directive.js', 'directive-helpers.js']
  .map(name => [`/lit/${name}`, resolve(litRoot, name)]));
const server = createServer(async(req, res) => {
  try {
    res.setHeader('Content-Type', 'text/javascript');
    if (req.url === '/contracts.js') { res.end(output[0].code); return; }
    if (req.url === '/jquery.js') { res.end(await readFile(jquery)); return; }
    if (req.url === '/morphdom.js') { res.end(await readFile(morphdom)); return; }
    if (litFiles.has(req.url)) {
      res.end(await readFile(litFiles.get(req.url)));
      return;
    }
    if (req.url !== '/') { res.statusCode = 404; res.end(); return; }
    res.setHeader('Content-Type', 'text/html');
    res.end(`<!doctype html><script type="importmap">{"imports":{
      "lit-html":"/lit/lit-html.js","lit-html/":"/lit/","morphdom":"/morphdom.js","jquery":"/jquery.js"
    }}</script>`);
  } catch (error) {
    res.statusCode = 500;
    res.end(error.message);
  }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const failures = [];
try {
  const escapedPathStatus = await new Promise((done, reject) => {
    request({ hostname: '127.0.0.1', port: server.address().port, path: '/lit/../../package.json' }, response => {
      response.resume();
      done(response.statusCode);
    }).on('error', reject).end();
  });
  assert.equal(escapedPathStatus, 404, 'Test server exposed a path outside its asset map');
  for (const [browserName, browserType] of Object.entries({ chromium, firefox, webkit })) {
    let browser;
    try {
      browser = await browserType.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      const results = await page.evaluate(async() => {
        const { domAdapterContracts } = await import('/contracts.js');
        return domAdapterContracts.map(({ name, run }) => {
          try { run(); return { name, passed: true }; } catch (error) { return { name, passed: false, error: error.stack }; }
        });
      });
      for (const result of results) {
        assert.equal(result.passed, true, `${browserName}: ${result.name}\n${result.error || ''}`);
      }
      console.log(`${browserName}: ${results.length} DOM adapter contracts passed`);
    } catch (error) {
      failures.push(new Error(`${browserName}: ${error.message}`, { cause: error }));
    } finally {
      await browser?.close();
    }
  }
} finally {
  await new Promise(done => server.close(done));
}
if (failures.length) { throw new AggregateError(failures, 'DOM adapter contracts failed.'); }
