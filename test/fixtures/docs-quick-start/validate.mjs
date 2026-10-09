import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const packageRoot = new URL('./', pathToFileURL(require.resolve('marionette/package.json')));
const source = await readFile(new URL('docs/quick-start.md', packageRoot), 'utf8');
const html = [...source.matchAll(/```html\n([\s\S]*?)```/g)];
const javascript = [...source.matchAll(/```js\n([\s\S]*?)```/g)];
assert.equal(html.length, 1, 'Quick start contains one complete document');
assert.equal(javascript.length, 1, 'Quick start contains one complete entry module');
const dom = new JSDOM(html[0][1], { url: 'https://example.test/' });
for (const key of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'DocumentFragment']) {
  globalThis[key] = dom.window[key];
}
const output = new URL('./dist/', import.meta.url);
await mkdir(output, { recursive: true });
// Add exports solely to inspect the objects created by the unchanged doc fence.
const script = new URL('main.mjs', output);
await writeFile(script, `${javascript[0][1]}\nexport { region, WelcomeView };\n`);
try {
  assert.throws(() => require.resolve('@mnjs/data'), { code: 'MODULE_NOT_FOUND' },
    'The first UI must work without the optional data package');
  const { region, WelcomeView } = await import(script);
  const first = region.currentView;
  assert.equal(document.querySelector('#app h1')?.textContent, 'Hello, Marionette');
  assert.equal(first.isRendered(), true);
  assert.equal(first.isAttached(), true);
  const replacement = new WelcomeView();
  region.show(replacement);
  assert.equal(first.isDestroyed(), true);
  assert.equal(region.currentView, replacement);
  assert.equal(document.querySelectorAll('#app h1').length, 1);
  region.empty();
  assert.equal(replacement.isDestroyed(), true);
  assert.equal(document.querySelector('#app').children.length, 0);
  region.destroy();
} finally {
  dom.window.close();
}
console.log('Installed quick-start HTML and entry module passed: render, replacement, cleanup, no optional data.');
