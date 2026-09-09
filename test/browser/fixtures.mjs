import { test as base } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '../..');

async function addJavaScriptAssets(assets, directory, prefix) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    const url = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      await addJavaScriptAssets(assets, file, url);
    } else if (entry.isFile() && /\.(?:m?js)$/.test(entry.name)) {
      assets.set(url, file);
    }
  }
}

export const test = base.extend({
  // Playwright requires fixture dependencies to be an object destructuring pattern.
  // eslint-disable-next-line no-empty-pattern
  candidateServer: [async({}, use) => {
    const candidate = JSON.parse(await readFile(process.env.MARIONETTE_BROWSER_CANDIDATE, 'utf8'));
    const assets = new Map([
      ['/contracts.js', resolve(root, 'test/contracts/dom-adapters.js')],
      ['/underscore.js', resolve(root, 'node_modules/underscore/underscore-umd.js')],
      ['/backbone.js', resolve(root, 'node_modules/backbone/backbone.js')],
      ['/jquery.js', resolve(root, 'node_modules/jquery/dist-module/jquery.module.js')],
      ['/morphdom.js', resolve(dirname(fileURLToPath(import.meta.resolve('morphdom'))), 'morphdom-esm.js')]
    ]);
    const imports = { jquery: '/jquery.js', morphdom: '/morphdom.js', 'lit-html': '/lit/lit-html.js', 'lit-html/': '/lit/' };
    for (const entry of candidate.packages) {
      const prefix = `/packages/${entry.id}`;
      await addJavaScriptAssets(assets, join(entry.directory, 'dist'), `${prefix}/dist`);
      for (const [subpath, condition] of Object.entries(entry.manifest.exports)) {
        const target = condition?.import?.default;
        if (!target) { continue; }
        const specifier = subpath === '.' ? entry.name : `${entry.name}${subpath.slice(1)}`;
        const url = `${prefix}/${target.replace(/^\.\//, '')}`;
        if (!assets.has(url)) { throw new Error(`Missing packed browser export: ${specifier}`); }
        imports[specifier] = url;
      }
      if (entry.id === 'core') {
        assets.set('/marionette.umd.js', join(entry.directory, entry.manifest.browser));
        assets.set('/starter.mjs', join(entry.directory, 'dist/docs/starter/workspace.ts'));
      }
    }
    const litRoot = dirname(fileURLToPath(import.meta.resolve('lit-html')));
    for (const name of ['lit-html.js', 'async-directive.js', 'directive.js', 'directive-helpers.js']) {
      assets.set(`/lit/${name}`, resolve(litRoot, name));
    }
    const html = `<!doctype html><script type="importmap">${JSON.stringify({ imports })}</script><main id="content"></main>`;
    const server = createServer(async(request, response) => {
      try {
        if (request.url === '/') {
          response.setHeader('content-type', 'text/html');
          response.end(html);
          return;
        }
        const asset = assets.get(request.url);
        if (!asset) { response.writeHead(404); response.end('Not found'); return; }
        response.setHeader('content-type', 'text/javascript');
        const source = await readFile(asset, 'utf8');
        response.end(asset.endsWith('.ts') ? ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2024, module: ts.ModuleKind.ESNext } }).outputText : source);
      } catch (error) {
        response.writeHead(500);
        response.end(error.message);
      }
    });
    await new Promise((done, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', done);
    });
    try {
      await use(`http://127.0.0.1:${server.address().port}`);
    } finally {
      await new Promise((done, reject) => server.close(error => error ? reject(error) : done()));
    }
  }, { scope: 'worker' }],
  page: async({ page, candidateServer }, use) => {
    await page.goto(candidateServer);
    await use(page);
  },
  umdPage: async({ page }, use) => {
    await page.addScriptTag({ url: '/marionette.umd.js' });
    await use(page);
  }
});
