import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const npmCli = process.env.npm_execpath;
if (!npmCli) {throw new Error('Run through npm run test:router-tarball, after npm run build.');}
const temporary = mkdtempSync(join(tmpdir(), 'mnjs-router-tarball-'));
try {
  const artifacts = join(temporary, 'artifacts');
  const consumer = join(temporary, 'consumer');
  mkdirSync(artifacts);
  mkdirSync(consumer);
  const pack = directory => {
    const [result] = JSON.parse(execFileSync(process.execPath, [npmCli, 'pack', directory,
      '--ignore-scripts', '--json', '--cache', join(temporary, 'cache'), '--pack-destination', artifacts], { cwd: root, encoding: 'utf8' }));
    return join(artifacts, result.filename);
  };
  const routerTarball = process.argv[2] ? resolve(process.argv[2]) : pack(join(root, 'packages/router'));
  const peers = ['.package', 'packages/utils', 'packages/radio'].map(directory => pack(join(root, directory)));
  writeFileSync(join(consumer, 'package.json'), '{"name":"router-tarball-consumer","private":true,"type":"module"}\n');
  execFileSync(process.execPath, [npmCli, 'install', '--ignore-scripts', '--offline', '--no-audit', '--no-fund',
    '--cache', join(temporary, 'cache'), routerTarball, ...peers], { cwd: consumer, stdio: 'inherit' });
  const installed = join(consumer, 'node_modules/@mnjs/router');
  assert.equal(JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8')).private, true);
  for (const file of ['DESIGN.md', 'PROVENANCE.md',
    'dist/index.js', 'dist/index.cjs', 'dist/types/esm/index.d.ts', 'dist/types/cjs/index.d.ts']) {
    assert.ok(readFileSync(join(installed, file)).length, file);
  }
  const smoke = `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    import * as esm from '@mnjs/router';
    import * as core from 'marionette';
    const require = createRequire(import.meta.url);
    const cjs = require('@mnjs/router');
    for (const [format, api, Base] of [['ESM', esm, core.Application], ['CJS', cjs, require('marionette').Application]]) {
      const work = Promise.withResolvers();
      const entered = Promise.withResolvers();
      let slowMatch;
      const router = new api.Router({
        driver: api.memoryDriver({ url: 'https://installed.example/team/pages/1' }),
        routes: { workspace: { path: '/:workspace', meta: { shell: true } } },
      });
      const definitions = api.defineRoutes({
        page: { path: 'pages/:id', meta: { feature: true }, handler: 'show' },
        slow: { path: 'slow', handler: 'slow' },
      });
      const Feature = api.RouteApplication.withRouter(router).extend({
        routeParent: 'workspace', routes: definitions,
        async show(match, { signal }) {
          assert.equal(await this.start(), true);
          signal.throwIfAborted();
          this.shown = match.params.id;
        },
        slow(match) { slowMatch = match; entered.resolve(); return work.promise; },
      });
      const Frame = Base.extend({ childApps: { feature: Feature } });
      const frame = new Frame();
      frame.addChildApp('router', router);
      const feature = frame.getChildApp('feature');
      const ready = [];
      router.on('route:ready', match => ready.push(match.url.pathname));
      assert.equal(feature.isRunning(), false);
      assert.equal(router.url('page', { workspace: 'team', id: 1 }), '/team/pages/1');
      await frame.start();
      await router.start();
      const initial = await router.getInitialDispatch();
      assert.equal(initial.status, 'matched');
      assert.equal(initial.match.name, 'page');
      assert.deepEqual(initial.match.meta, { shell: true, feature: true });
      assert.deepEqual(initial.match.branch.map(entry => entry.name), ['workspace', 'page']);
      assert.equal(feature.shown, '1');
      feature.stop();
      assert.equal(router.hasRoute('page'), true);
      assert.equal(await router.navigate('page', { workspace: 'team', id: 2 }).finished, true);
      assert.equal(feature.shown, '2');
      const obsolete = router.navigate('slow', { workspace: 'team' });
      await entered.promise;
      feature.destroy();
      assert.equal(slowMatch.signal.aborted, true);
      assert.equal(await obsolete.finished, false);
      assert.equal(router.getCurrent(), null);
      assert.equal(router.hasRoute('page'), false);
      router.mount({ slow: { path: '/replacement' } });
      assert.equal(await router.navigate('slow').finished, true);
      work.resolve();
      await work.promise;
      assert.deepEqual(ready, ['/team/pages/1', '/team/pages/2', '/replacement']);
      assert.equal(router.getCurrent().url.pathname, '/replacement');
      const fake = { cid: 'fake', start() {}, stop() {}, destroy() {}, isRunning() {}, isDestroyed() {return false;}, getName() {} };
      assert.throws(() => frame.addChildApp('fake', fake), error => error.code === 'MN0031');
      assert.deepEqual(router.getCurrent().params, {});
      frame.destroy();
      assert.equal(router.isDestroyed(), true);

      const unmatched = new api.Router({ driver: api.memoryDriver({ url: 'https://installed.example/outside' }) });
      await unmatched.start();
      assert.deepEqual(await unmatched.getInitialDispatch(), { status: 'unmatched' });
      assert.equal(unmatched.isRunning(), true);
      unmatched.destroy();

      const failure = new Error('failed initial handler');
      const failed = new api.Router({ driver: api.memoryDriver({ url: 'https://installed.example/fail' }),
        routes: { fail: { path: '/fail', handler() {throw failure;} } } });
      await failed.start();
      const result = await failed.getInitialDispatch();
      assert.equal(result.status, 'failed');
      assert.equal(result.error, failure);
      assert.equal(failed.isRunning(), true);
      failed.destroy();

      const ignored = Promise.withResolvers();
      const cancelled = new api.Router({ driver: api.memoryDriver({ url: 'https://installed.example/cancel' }),
        routes: { cancel: { path: '/cancel', handler() {return ignored.promise;} } } });
      await cancelled.start();
      const pendingInitial = cancelled.getInitialDispatch();
      cancelled.stop();
      assert.deepEqual(await pendingInitial, { status: 'cancelled' });
      ignored.resolve();
      cancelled.destroy();
      console.log(format + ' installed tarball: explicit injection, parent metadata, UI retention, owner cancellation, name reuse, fake-child rejection and all initial outcomes passed.');
    }
  `;
  writeFileSync(join(consumer, 'smoke.mjs'), smoke);
  execFileSync(process.execPath, ['smoke.mjs'], { cwd: consumer, stdio: 'inherit' });
  writeFileSync(join(consumer, 'correctness-probes.mjs'), readFileSync(join(root, 'test/router/correctness-probes.mjs')));
  execFileSync(process.execPath, ['correctness-probes.mjs'], { cwd: consumer, stdio: 'inherit' });
  console.log(`Router tarball SHA-256: ${createHash('sha256').update(readFileSync(routerTarball)).digest('hex')}`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
