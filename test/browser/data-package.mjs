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

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'marionette-data-browser-'));
try {
  const packDirectory = resolve(temporaryDirectory, 'pack');
  const coreDirectory = resolve(temporaryDirectory, 'core');
  const dataDirectory = resolve(temporaryDirectory, 'data');
  await Promise.all([
    mkdir(packDirectory),
    mkdir(coreDirectory),
    mkdir(dataDirectory)
  ]);

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
  const dataTarball = pack(resolve(root, 'packages/data'));
  execFileSync('tar', ['-xzf', coreTarball, '-C', coreDirectory]);
  execFileSync('tar', ['-xzf', dataTarball, '-C', dataDirectory]);

  const assets = new Map([
    ['/marionette.js', resolve(coreDirectory, 'package/dist/marionette.js')],
    ['/data.js', resolve(dataDirectory, 'package/dist/index.js')]
  ]);
  const html = `<!doctype html>
<html>
  <head>
    <script type="importmap">
      { "imports": { "marionette": "/marionette.js" } }
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
          const { createMarionette } = await import('/marionette.js');
          const { Collection, DataApi, Model, StateApi } = await import('/data.js');
          const runtime = createMarionette();
          runtime.setDataApi(DataApi);
          runtime.setStateApi(StateApi);
          const calls = { collection: 0, model: 0, state: 0 };
          const TestView = runtime.View.extend({
            collectionEvents: { update: 'onCollectionUpdate' },
            modelEvents: { 'change:label': 'onModelChange' },
            onCollectionUpdate() { calls.collection++; },
            onModelChange() { calls.model++; }
          });
          const StateOwner = runtime.MnObject.extend({
            stateEvents: { 'change:ready': 'onReady' },
            createState() { return new Model({ ready: false }); },
            onReady() { calls.state++; }
          });
          const model = new Model({ id: 1, label: 'one' });
          const collection = new Collection([model]);
          const view = new TestView({
            collection,
            el: document.createElement('section'),
            model
          });
          const owner = new StateOwner();
          const state = owner.getState();

          collection.add({ id: 2, label: 'two' });
          model.set('label', 'ONE');
          state.set('ready', true);
          const items = DataApi.items(collection).map(item => item.id);
          view.destroy();
          owner.destroy();
          collection.destroy();

          return { calls, items, stateDestroyed: state.isDestroyed() };
        });

        assert.deepEqual(result, {
          calls: { collection: 1, model: 1, state: 1 },
          items: [1, 2],
          stateDestroyed: true
        }, `${browserName}: packed @marionette/data runtime behavior`);
        console.log(`${browserName}: packed @marionette/data runtime passed`);
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
    throw new AggregateError(failures, 'Packed @marionette/data browser runtime failed.');
  }
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true });
}
