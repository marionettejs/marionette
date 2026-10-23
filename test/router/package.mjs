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
      const switcher = new api.ChildAppSwitcher();
      switcher.destroy();
      assert.throws(() => new api.Router({ driver, routes: [{ name: 'item', path: '/item' }] }), /URLPattern/);
    }
    console.log('ESM/CJS imports and non-matching exports do not acquire URLPattern.');
  `);

  run(`
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    import { Application } from 'marionette';
    import * as esm from '@mnjs/router';
    const require = createRequire(import.meta.url);
    const cjs = require('@mnjs/router');
    assert.throws(() => require('@mnjs/router/outlet'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
    for (const api of [esm, cjs]) {
      const BaseApplication = api === esm ? Application : require('marionette').Application;
      assert.equal('createRouterClass' in api, false);
      assert.equal('createChildAppSwitcherClass' in api, false);
      const driver = api.memoryDriver({ url: 'http://localhost/' });
      const Routes = api.Router.extend({
        routes: [{ name: 'home', path: '/' }],
        initialize() { this.initialized = this.url('home'); },
      });
      const router = new Routes({ driver });
      assert.equal(router instanceof BaseApplication, true);
      assert.equal(router.initialized, '/');
      const Feature = api.RouteApplication.extend({
        routes: { item: { path: '/items/:id', handler: 'showItem' } },
        showItem(match) { this.item = match.params.id; },
      });
      const feature = new Feature({ router });
      assert.equal(router.url('item', { id: 7 }), '/items/7');
      assert.equal(await router.start(), true);
      assert.equal(router.getCurrent().name, 'home');
      assert.equal(router.canGoBack(), false);
      assert.equal(await router.navigate('item', { id: 7 }).finished, true);
      assert.equal(feature.item, '7');
      feature.destroy();
      assert.equal(router.hasRoute('item'), false);
      router.destroy();
      assert.equal(await router.start(), false);
      assert.equal(await router.navigate('/').finished, false);
      assert.equal(router.isDestroyed(), true);
      assert.deepEqual(driver.documentNavigations, []);

      const owner = new BaseApplication();
      const Extended = api.ChildAppSwitcher.extend({ initialize() { this.initialized = true; } });
      const switcher = owner.addChildApp('pages', new Extended());
      const page = switcher.addChildApp('page', new BaseApplication());
      await switcher.start();
      assert.equal(switcher.initialized, true);
      assert.equal(await switcher.switchTo('page'), page);
      assert.equal(await switcher.switchTo('page', { reconstruct: true }), page);
      assert.equal(switcher.getChildApp('page'), page);
      owner.destroy();
      assert.equal(switcher.isDestroyed(), true);
    }
    // Verify child-owned readiness replacement against a plain Application control.
    async function initialReplacement(Switcher, BaseApplication = Application) {
      const first = Promise.withResolvers();
      const replacement = Promise.withResolvers();
      const replacing = Promise.withResolvers();
      let runs = 0;
      let restarted;
      let stops = 0;
      const Page = BaseApplication.extend({
        prepareStart() {
          runs++;
          if (runs === 1) {
            queueMicrotask(() => { restarted = this.restart(); replacing.resolve(); });
            return first.promise;
          }
          return replacement.promise;
        },
      });
      const owner = Switcher ? new Switcher() : new BaseApplication();
      await owner.start();
      const page = owner.addChildApp('page', new Page());
      page.on('stop', () => stops++);
      const switcher = Switcher ? owner : null;
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
    await initialReplacement(cjs.ChildAppSwitcher, require('marionette').Application);
    console.log('Router/switcher ESM/CJS lifecycle, default Application family, reconstruction and child-restart control passed.');
  `);
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
