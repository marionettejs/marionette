import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const root = resolve(import.meta.dirname, '../..');
const npmCli = process.env.npm_execpath;
if (!npmCli) {
  throw new Error('Run browser tests through npm so the npm CLI can be located.');
}

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'marionette-adapters-browser-'));
try {
  const packDirectory = resolve(temporaryDirectory, 'pack');
  const coreDirectory = resolve(temporaryDirectory, 'core');
  const adaptersDirectory = resolve(temporaryDirectory, 'adapters');
  await Promise.all([mkdir(packDirectory), mkdir(coreDirectory), mkdir(adaptersDirectory)]);

  function pack(source) {
    const output = execFileSync(process.execPath, [
      npmCli,
      'pack',
      source,
      '--ignore-scripts',
      '--json',
      '--pack-destination',
      packDirectory
    ], { cwd: root, encoding: 'utf8' });
    const results = JSON.parse(output);
    if (results.length !== 1) {
      throw new Error(`Expected one packed artifact for ${source}.`);
    }
    return resolve(packDirectory, results[0].filename);
  }

  const coreTarball = pack(root);
  const adaptersTarball = pack(resolve(root, 'packages/adapters'));
  execFileSync('tar', ['-xzf', coreTarball, '-C', coreDirectory]);
  execFileSync('tar', ['-xzf', adaptersTarball, '-C', adaptersDirectory]);

  const assets = new Map([
    ['/marionette.js', resolve(coreDirectory, 'package/dist/marionette.js')],
    ['/backbone-api.js', resolve(adaptersDirectory, 'package/dist/backbone.js')],
    ['/jquery-api.js', resolve(adaptersDirectory, 'package/dist/dom/jquery.js')],
    ['/jquery.js', resolve(root, 'node_modules/jquery/dist-module/jquery.module.js')],
    ['/underscore.js', resolve(root, 'node_modules/underscore/underscore-umd.js')],
    ['/backbone.js', resolve(root, 'node_modules/backbone/backbone.js')]
  ]);
  const html = `<!doctype html>
<html>
  <head>
    <script src="/underscore.js"></script>
    <script src="/backbone.js"></script>
    <script type="importmap">
      { "imports": { "jquery": "/jquery.js" } }
    </script>
  </head>
  <body></body>
</html>`;
  const server = createServer(async function(request, response) {
    try {
      if (request.url === '/') {
        response.setHeader('content-type', 'text/html');
        response.end(html);
        return;
      }
      const file = assets.get(request.url);
      if (!file) {
        response.statusCode = 404;
        response.end('Not found');
        return;
      }
      response.setHeader('content-type', 'text/javascript');
      response.end(await readFile(file));
    } catch (error) {
      response.statusCode = 500;
      response.end(error.message);
    }
  });

  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  const browsers = { chromium, firefox, webkit };
  const failures = [];

  try {
    for (const [browserName, browserType] of Object.entries(browsers)) {
      let browser;
      try {
        browser = await browserType.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(`http://127.0.0.1:${address.port}`);
        const result = await page.evaluate(async function() {
          const Backbone = window.Backbone;
          const originalBind = Backbone.Model.prototype.bind;
          const model = new Backbone.Model({ id: 1, name: 'before' });
          let preconfigurationCalls = 0;
          model.on('change:name', () => preconfigurationCalls++);

          const [Marionette, { default: BackboneApi }, { default: JQueryDomApi }] = await Promise.all([
            import('/marionette.js'),
            import('/backbone-api.js'),
            import('/jquery-api.js')
          ]);
          const runtime = Marionette.createMarionette();
          runtime.setDataApi(BackboneApi);
          runtime.setStateApi(BackboneApi);
          const collection = new Backbone.Collection([model]);
          let modelCalls = 0;
          const ChildView = runtime.View.extend({ template: false });
          const ListView = runtime.CollectionView.extend({
            childView: ChildView,
            modelEvents: { 'change:name': 'onName' },
            onName() { modelCalls++; }
          });
          const view = new ListView({ collection, model });
          view.render();
          collection.add({ id: 2, name: 'second' });
          model.set('name', 'after');

          const JQueryView = runtime.View.extend({ template: false });
          JQueryView.setDomApi(JQueryDomApi);
          const el = document.createElement('section');
          el.innerHTML = '<span class="child">child</span>';
          const jqueryView = new JQueryView({ el });
          const jqueryResult = jqueryView.$('.child');

          const output = {
            children: view.children.length,
            jqueryText: jqueryResult[0].textContent,
            modelCalls,
            nativeBindPreserved: Backbone.Model.prototype.bind === originalBind,
            preconfigurationCalls,
            triggerMethodAbsent: Backbone.Model.prototype.triggerMethod === undefined
          };
          jqueryView.destroy();
          view.destroy();
          return output;
        });

        assert.deepEqual(result, {
          children: 2,
          jqueryText: 'child',
          modelCalls: 1,
          nativeBindPreserved: true,
          preconfigurationCalls: 1,
          triggerMethodAbsent: true
        }, `${browserName}: packed @marionette/adapters runtime behavior`);
        console.log(`${browserName}: packed @marionette/adapters runtime passed`);
      } catch (error) {
        failures.push(new Error(`${browserName}: ${error.message}`, { cause: error }));
      } finally {
        await browser?.close();
      }
    }
  } finally {
    await new Promise(resolveClose => server.close(resolveClose));
  }

  if (failures.length) {
    throw new AggregateError(failures, 'Packed @marionette/adapters browser runtime failed.');
  }
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true });
}
