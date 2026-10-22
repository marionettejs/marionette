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
    const { Application } = await import('marionette');
    for (const api of [esm, cjs]) {
      const driver = api.memoryDriver({ url: 'https://example.test/' });
      assert.equal(driver.currentEntry.url, 'https://example.test/');
      const owner = new Application();
      const switcher = new api.ChildAppSwitcher({ owner });
      switcher.destroy(); owner.destroy();
      assert.throws(() => new api.Router({ driver, routes: [{ name: 'item', path: '/item' }] }), /URLPattern/);
    }
    console.log('ESM/CJS imports and non-matching exports do not acquire URLPattern.');
  `);

  run(`
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    import { Application, MnObject, createMarionette } from 'marionette';
    import * as esm from '@mnjs/router';
    const require = createRequire(import.meta.url);
    const cjs = require('@mnjs/router');
    assert.throws(() => require('@mnjs/router/outlet'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
    for (const api of [esm, cjs]) {
      const driver = api.memoryDriver({ url: 'http://localhost/' });
      const Routes = api.Router.extend({
        routes: [{ name: 'home', path: '/' }],
        initialize() { this.initialized = this.url('home'); },
      });
      const router = new Routes({ driver });
      assert.equal(router.initialized, '/');
      assert.equal(await router.start(), true);
      assert.equal(router.getCurrent().name, 'home');
      router.destroy();
      assert.equal(await router.start(), false);
      assert.equal(await router.navigate('/').finished, false);
      assert.equal(router.isDestroyed(), true);
      assert.deepEqual(driver.documentNavigations, []);

      const owner = new Application();
      const page = owner.addChildApp('page', new Application());
      const Extended = api.ChildAppSwitcher.extend({ initialize() { this.initialized = true; } });
      const switcher = new Extended({ owner });
      assert.equal(switcher.initialized, true);
      assert.equal(await switcher.switchTo('page'), page);
      assert.equal(await switcher.switchTo('page', { reconstruct: true }), page);
      assert.equal(owner.getChildApp('page'), page);
      owner.destroy();
      assert.equal(switcher.isDestroyed(), true);
    }
    const runtime = createMarionette();
    const Scoped = esm.Router.extend({ Radio: runtime.Radio, State: runtime.MnObject.prototype.State });
    const scoped = new Scoped({ driver: esm.memoryDriver({ url: 'http://localhost/' }), routes: [] });
    assert.equal(scoped.Radio, runtime.Radio);
    assert.equal(scoped.State, runtime.MnObject.prototype.State);
    assert.ok(scoped instanceof MnObject);
    scoped.destroy();

    // Verify child-owned readiness replacement against a plain Application control.
    async function initialReplacement(Switcher) {
      const first = Promise.withResolvers();
      const replacement = Promise.withResolvers();
      const replacing = Promise.withResolvers();
      let runs = 0;
      let restarted;
      let stops = 0;
      const Page = Application.extend({
        prepareStart() {
          runs++;
          if (runs === 1) {
            queueMicrotask(() => { restarted = this.restart(); replacing.resolve(); });
            return first.promise;
          }
          return replacement.promise;
        },
      });
      const owner = new Application();
      const page = owner.addChildApp('page', new Page());
      page.on('stop', () => stops++);
      const switcher = Switcher ? new Switcher({ owner }) : null;
      const initial = switcher ? switcher.switchTo('page') : page.start();
      await replacing.promise;
      replacement.resolve();
      assert.equal(await initial, switcher ? undefined : false);
      assert.equal(await restarted, true);
      assert.equal(page.isRunning(), true);
      assert.equal(stops, 0);
      assert.equal(runs, 2);
      if (switcher) assert.equal(switcher.getCurrent(), page);
      first.resolve();
      owner.destroy();
      assert.equal(page.isDestroyed(), true);
    }
    await initialReplacement(null);
    await initialReplacement(esm.ChildAppSwitcher);
    await initialReplacement(cjs.ChildAppSwitcher);
    console.log('Router/switcher ESM/CJS lifecycle, isolated providers, reconstruction and child-restart control passed.');
  `);
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
