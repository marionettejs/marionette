import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { chromium, firefox, webkit } from 'playwright';

const require = createRequire(import.meta.url);
const root = new URL('../../', import.meta.url);
const markdown = await readFile(new URL('docs/routing.md', root), 'utf8');
const blocks = [...markdown.matchAll(/```javascript\n([\s\S]*?)\n```/g)].map(match => match[1]);
const moduleFor = name => {
  const code = blocks.find(block => block.includes(`export ${name}`));
  assert.ok(code, `documented module ${name} exists`);
  return code;
};
const assets = {
  '/feature.js': moduleFor('async function createPageNavigation'),
  '/native.js': moduleFor('function connectNavigation'),
  '/backbone-integration.js': moduleFor('function connectBackbone'),
  '/marionette.js': await readFile(new URL('dist/marionette.js', root), 'utf8'),
  '/utils.js': await readFile(new URL('packages/utils/dist/index.js', root), 'utf8'),
  '/radio.js': await readFile(new URL('packages/radio/dist/index.js', root), 'utf8'),
  '/backbone.js': 'export default window.Backbone;',
  '/underscore-module.js': 'export const template = window._.template;',
  '/backbone-global.js': await readFile(require.resolve('backbone'), 'utf8'),
  '/underscore.js': await readFile(require.resolve('underscore/underscore-umd.js'), 'utf8')
};

for (const [browserName, browserType] of Object.entries({ chromium, firefox, webkit })) {
  for (const kind of ['native', 'backbone']) {
    test(`${browserName}: documented ${kind} routing`, async() => {
      const browser = await browserType.launch();
      try {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://routing.test/**', route => {
          const asset = assets[new URL(route.request().url()).pathname];
          return route.fulfill(asset !== undefined ?
            { contentType: 'text/javascript', body: asset } :
            { contentType: 'text/html', body: `<main id="page"></main>
              <a href="/pages/link">Link</a>
              <script type="importmap">{"imports":{"marionette":"/marionette.js",
              "@mnjs/utils":"/utils.js","@mnjs/radio":"/radio.js","backbone":"/backbone.js",
              "underscore":"/underscore-module.js"}}</script>
              <script src="/underscore.js"></script><script src="/backbone-global.js"></script>` });
        });
        await page.goto(kind === 'native' ? 'https://routing.test/pages/initial' : 'https://routing.test/#/pages/initial');
        await page.evaluate(async routerKind => {
          const { createPageNavigation } = await import('/feature.js');
          window.requests = new Map();
          window.failures = [];
          window.feature = await createPageNavigation({
            el: document.querySelector('#page'),
            loadPage(id, { signal }) {
              const request = { signal, ...Promise.withResolvers() };
              window.requests.set(id, request);
              return request.promise; // Deliberately ignores abort.
            }
          });
          const onError = error => window.failures.push(error.message);
          if (routerKind === 'native') {
            const { connectNavigation } = await import('/native.js');
            window.connection = connectNavigation(window.feature, onError);
          } else {
            const { connectBackbone } = await import('/backbone-integration.js');
            window.connection = connectBackbone(window.feature, onError);
          }
          window.go = id => {
            if (routerKind === 'native') {
              void navigation.navigate('/pages/' + id).finished.catch(() => {});
            } else {
              window.connection.router.navigate('pages/' + id, { trigger: true });
            }
          };
          window.resolvePage = id => window.requests.get(id).resolve({ title: id, body: 'Page body' });
        }, kind);
        const requested = name => page.waitForFunction(id => window.requests.has(id), name);
        const displayed = name => page.waitForFunction(id => document.querySelector('h1')?.textContent === id, name);
        await requested('initial');
        await page.evaluate(() => window.resolvePage('initial'));
        await displayed('initial');
        await page.evaluate(() => { window.oldView = window.feature.application.getView(); window.go('slow'); });
        await requested('slow');
        await page.evaluate(() => window.go('fast'));
        await requested('fast');
        assert.equal(await page.evaluate(() => window.requests.get('slow').signal.aborted), true);
        await page.evaluate(() => window.resolvePage('fast'));
        await displayed('fast');
        assert.equal(await page.evaluate(() => window.oldView.isDestroyed()), true);
        await page.evaluate(() => { window.requests.get('slow').reject(new Error('stale')); window.go('failed'); });
        await requested('failed');
        await page.evaluate(() => window.requests.get('failed').reject(new Error('current')));
        await page.waitForFunction(() => window.failures.length === 1);
        assert.deepEqual(await page.evaluate(() => window.failures), ['current']);
        assert.equal(await page.locator('h1').textContent(), 'fast');
        await page.evaluate(() => window.go('retry'));
        await requested('retry');
        await page.evaluate(() => window.resolvePage('retry'));
        await displayed('retry');
        await page.goBack();
        await page.waitForFunction(() => location.href.includes('failed'));
        await page.evaluate(() => window.resolvePage('failed'));
        await displayed('failed');
        await page.goForward();
        await page.evaluate(() => window.resolvePage('retry'));
        await displayed('retry');
        if (kind === 'native') {
          await page.click('a');
          await requested('link');
          await page.evaluate(() => window.resolvePage('link'));
          await displayed('link');
        } else {
          await page.evaluate(() => window.connection.router.navigate('outside', { trigger: true }));
          assert.equal(await page.locator('#page').textContent(), '');
        }
        await page.evaluate(() => window.go('destroyed'));
        await requested('destroyed');
        await page.evaluate(async() => { await window.connection.destroy(); window.resolvePage('destroyed'); });
        assert.equal(await page.evaluate(() => window.requests.get('destroyed').signal.aborted), true);
        assert.equal(await page.locator('#page').textContent(), '');
        assert.deepEqual(errors, []);
        if (kind === 'native') {
          await page.evaluate(() => { void navigation.navigate('/pages/after-destroy').finished.catch(() => {}); });
          await page.waitForFunction(() => !window.feature);
          assert.equal(new URL(page.url()).pathname, '/pages/after-destroy',
            'destroy releases interception so the browser loads a new document');

          // Install a fresh owner, then leave its URL scope during initial loading.
          await page.evaluate(async() => {
            const { createPageNavigation } = await import('/feature.js');
            const { connectNavigation } = await import('/native.js');
            const owner = await createPageNavigation({
              el: document.querySelector('#page'),
              loadPage(id, { signal }) {
                signal.addEventListener('abort', () => sessionStorage.setItem('left-aborted', 'yes'));
                return new Promise(() => {});
              }
            });
            window.connection = connectNavigation(owner, error => { throw error; });
            void navigation.navigate('/outside').finished.catch(() => {});
          });
          await page.waitForFunction(() => location.pathname === '/outside' && !window.connection);
          assert.equal(await page.evaluate(() => sessionStorage.getItem('left-aborted')), 'yes',
            'leaving the native route scope aborts pending loading before document navigation');
        }
      } finally {
        await browser.close();
      }
    });
  }
}
