import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { memoryDriver } from '@mnjs/router';

// Execute the installed README's actual pre-import recipe, with a test-local
// eager application. Capability presence here does not certify a browser.
const packageRoot = dirname(fileURLToPath(import.meta.resolve('@mnjs/router/package.json')));
const blocks = [...readFileSync(join(packageRoot, 'readme.md'), 'utf8').matchAll(/```js\n([\s\S]*?)\n```/g)];
const recipe = blocks[1][1];
const directory = mkdtempSync(join(import.meta.dirname, 'pre-import-'));
cpSync(join(import.meta.dirname, 'eager-router.mjs'), join(directory, 'app.js'));
const appSource = readFileSync(join(directory, 'app.js'), 'utf8');
writeFileSync(join(directory, 'app.js'), `globalThis.eagerAppImports++;\n${appSource}`);
const originalNavigation = Object.getOwnPropertyDescriptor(globalThis, 'navigation');
Object.defineProperty(globalThis, 'navigation', { configurable: true, value: memoryDriver({ url: 'https://desk.example/' }) });
globalThis.eagerAppImports = 0;
let sequence = 0;
async function runRecipe() {
  const file = join(directory, `entry-${sequence++}.mjs`);
  writeFileSync(file, recipe);
  await import(pathToFileURL(file));
}
try {
  for (const [owner, property, name] of [
    [globalThis, 'URLPattern', 'URLPattern'], [AbortSignal, 'any', 'AbortSignal.any'],
    [Promise, 'withResolvers', 'Promise.withResolvers'], [URL, 'canParse', 'URL.canParse'],
    [globalThis, 'navigation', 'Navigation API'],
  ]) {
    const descriptor = Object.getOwnPropertyDescriptor(owner, property);
    try {
      Object.defineProperty(owner, property, { configurable: true, value: undefined });
      await runRecipe();
      assert.equal(globalThis.eagerAppImports, 0, `${name}: eager application must not be imported`);
      const api = await import('@mnjs/router');
      if (name === 'URLPattern') {
        assert.throws(() => new api.Router({ driver: api.memoryDriver({ url: 'https://desk.example/' }), routes: { home: { path: '/' } } }), /URLPattern/);
      }
    } finally { Object.defineProperty(owner, property, descriptor); }
  }
  await runRecipe();
  assert.equal(globalThis.eagerAppImports, 1);
  const { router } = await import(pathToFileURL(join(directory, 'app.js')));
  assert.equal(router.isRunning(), true);
  assert.deepEqual(await router.getInitialDispatch(), { status: 'unmatched' });
  router.destroy();
  console.log('Installed README pre-import recipe: each missing capability blocks eager construction; supported presence permits startup.');
} finally {
  if (originalNavigation) { Object.defineProperty(globalThis, 'navigation', originalNavigation); } else { delete globalThis.navigation; }
  delete globalThis.eagerAppImports;
  rmSync(directory, { recursive: true, force: true });
}
