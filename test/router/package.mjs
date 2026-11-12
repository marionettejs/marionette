import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const fixture = mkdtempSync(join(tmpdir(), 'mnjs-router-package-'));
try {
  const modules = join(fixture, 'node_modules');
  const installed = join(modules, '@mnjs/router');
  mkdirSync(installed, { recursive: true });
  symlinkSync(join(root, 'packages/utils'), join(modules, '@mnjs/utils'), 'junction');
  writeFileSync(join(fixture, 'package.json'), '{"private":true,"type":"module"}\n');
  cpSync(join(root, 'packages/router/package.json'), join(installed, 'package.json'));
  cpSync(join(root, 'packages/router/dist'), join(installed, 'dist'), { recursive: true });
  const run = source => execFileSync(process.execPath, ['--input-type=module', '--eval', source], {
    cwd: fixture, stdio: 'inherit'
  });
  run(`
    import assert from 'node:assert/strict';
    await assert.rejects(import('@mnjs/router'), error => error.code === 'ERR_MODULE_NOT_FOUND' && error.message.includes('marionette'));
    console.log('Router requires its declared Marionette peer.');
  `);
  symlinkSync(root, join(modules, 'marionette'), 'junction');
  run(`
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    delete globalThis.URLPattern;
    const esm = await import('@mnjs/router');
    const cjs = createRequire(import.meta.url)('@mnjs/router');
    for (const api of [esm, cjs]) {
      const driver = api.memoryDriver({ url: 'https://example.test/' });
      assert.equal(driver.currentEntry.url, 'https://example.test/');
      const switcher = new api.RouteApplication();
      switcher.destroy();
      assert.throws(() => new api.Router({ driver, routes: [{ name: 'item', path: '/item' }] }), /URLPattern/);
    }
    console.log('ESM/CJS imports and non-matching exports do not acquire URLPattern.');
  `);

  cpSync(join(root, 'test/router/consumer/package-smoke.mjs'), join(fixture, 'smoke.mjs'));
  execFileSync(process.execPath, ['smoke.mjs'], { cwd: fixture, stdio: 'inherit' });
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
