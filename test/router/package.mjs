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
  symlinkSync(join(root, 'packages/utils'), join(modules, '@mnjs/utils'), 'junction');
  const run = source => execFileSync(process.execPath, ['--input-type=module', '--eval', source], {
    cwd: fixture, stdio: 'inherit'
  });
  run(`
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    import { Router, memoryDriver } from '@mnjs/router';
    const cjs = createRequire(import.meta.url)('@mnjs/router');
    for (const api of [{ Router, memoryDriver }, cjs]) {
      const router = new api.Router({ routes: [{ name: 'home', path: '/' }], driver: api.memoryDriver() });
      assert.equal(await router.start(), true);
      assert.equal(router.getCurrent().name, 'home');
      router.stop();
    }
    await assert.rejects(import('@mnjs/router/outlet'), { code: 'ERR_MODULE_NOT_FOUND' });
    console.log('Router ESM/CJS exports work without Marionette; outlet correctly requires it.');
  `);
  symlinkSync(root, join(modules, 'marionette'), 'junction');
  run(`
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    import { Application } from 'marionette';
    import { RouteOutlet } from '@mnjs/router/outlet';
    const cjs = createRequire(import.meta.url)('@mnjs/router/outlet');
    for (const Outlet of [RouteOutlet, cjs.RouteOutlet]) {
      const owner = new Application();
      const page = owner.addChildApp('page', new Application());
      const Extended = Outlet.extend({ initialize() { this.initialized = true; } });
      const outlet = new Extended({ owner });
      assert.equal(outlet.initialized, true);
      assert.equal(await outlet.show('page'), page);
      owner.destroy();
      assert.equal(outlet.isDestroyed(), true);
    }
    // Compare plain Application readiness with selection of the same workflow.
    // This process uses installed distributions, with no Vitest aliases or mocks.
    async function initialReplacement(Outlet) {
      const first = Promise.withResolvers();
      const replacement = Promise.withResolvers();
      const replacing = Promise.withResolvers();
      let runs = 0;
      let restarts;
      let stops = 0;
      const Page = Application.extend({
        prepareStart() {
          runs++;
          if (runs === 1) {
            queueMicrotask(() => { restarts = this.restart(); replacing.resolve(); });
            return first.promise;
          }
          return replacement.promise;
        },
      });
      const owner = new Application();
      const page = owner.addChildApp('page', new Page());
      page.on('stop', () => stops++);
      const outlet = Outlet ? new Outlet({ owner }) : null;
      const initial = outlet ? outlet.show('page') : page.start();
      await replacing.promise;
      replacement.resolve();
      assert.equal(await initial, outlet ? undefined : false);
      assert.equal(await restarts, true);
      assert.equal(page.isRunning(), true);
      assert.equal(stops, 0);
      assert.equal(runs, 2);
      if (outlet) assert.equal(outlet.getCurrent(), page);
      first.resolve();
      owner.destroy();
      assert.equal(page.isDestroyed(), true);
    }
    await initialReplacement(null);
    await initialReplacement(RouteOutlet);
    await initialReplacement(cjs.RouteOutlet);
    console.log('Outlet ESM/CJS extension, ownership, and child-restart parity with plain Application passed.');
  `);
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
