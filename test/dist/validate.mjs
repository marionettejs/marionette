import assert from 'assert';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import vm from 'vm';

const args = process.argv.slice(2);
const rootIndex = args.indexOf('--root');
if (rootIndex !== -1 && (!args[rootIndex + 1] || args[rootIndex + 1].startsWith('--'))) {
  throw new Error('Missing value for --root');
}
const packageRoot = rootIndex === -1 ?
  resolve(import.meta.dirname, '../..') :
  resolve(args[rootIndex + 1]);
const require = createRequire(pathToFileURL(resolve(packageRoot, 'package.json')));
const packageJson = require(resolve(packageRoot, 'package.json'));
const removedRootUtilities = [
  'bindEvents',
  'unbindEvents',
  'bindRequests',
  'unbindRequests',
  'mergeOptions',
  'getOption',
  'normalizeMethods',
  'triggerMethod',
];
const removedRadioProperties = ['Channel', 'log', 'debugLog', '_channels'];

function validateRadio(Marionette, name) {
  for (const property of removedRadioProperties) {
    assert.strictEqual(Object.hasOwn(Marionette.Radio, property), false, `${name} Radio.${property} absence`);
  }
}

function validateRequestBoundary(Marionette, name) {
  for (const className of ['Application', 'Behavior', 'CollectionView', 'MnObject', 'Region', 'View']) {
    for (const methodName of ['reply', 'replyOnce', 'stopReplying', 'request']) {
      assert.strictEqual(
        methodName in Marionette[className].prototype,
        false,
        `${name} ${className}.${methodName} absence`,
      );
    }
  }
}

function validateCollectionTemplateData(Marionette, name) {
  const model = { name: 'plain' };
  const data = Marionette.View.prototype.serializeData.call({
    collection: [model],
    Data: Marionette.DataApi,
    serializeCollection: Marionette.View.prototype.serializeCollection,
  });

  assert.deepStrictEqual(Object.keys(data), ['models'], `${name} collection template property`);
  assert.strictEqual(data.models.length, 1, `${name} serialized collection length`);
  assert.strictEqual(data.models[0], model, `${name} serialized collection value`);
  assert.strictEqual(Object.hasOwn(data, 'items'), false, `${name} removed collection template items`);
}

function validateRegionDisplayInput(Marionette, name) {
  const region = new Marionette.Region({ el: { nodeType: 1 } });

  for (const value of ['content', () => 'content', Marionette.View, { template: () => 'content' }]) {
    assert.throws(
      () => region.show(value),
      error => error.code === 'MN0006',
      `${name} explicit Region View input`,
    );
  }
}

async function validateBrowserGlobal(file) {
  const previousMarionette = {};
  const context = {
    AbortController,
    Marionette: previousMarionette,
  };

  vm.runInNewContext(
    readFileSync(resolve(packageRoot, 'dist', file), 'utf8'),
    context,
    { filename: file },
  );

  const Marionette = context.Marionette;

  assert.strictEqual(Marionette.VERSION, packageJson.version, `${file} browser-global version`);
  assert.strictEqual(typeof Marionette.MarionetteError, 'function', `${file} MarionetteError export`);
  assert.strictEqual(Object.hasOwn(Marionette, 'State'), false, `${file} State absence`);
  assert.strictEqual(typeof Marionette.StateApi, 'object', `${file} StateApi export`);
  assert.strictEqual(typeof Marionette.setStateApi, 'function', `${file} setStateApi export`);
  assert.strictEqual(typeof Marionette.DataApi, 'object', `${file} DataApi export`);
  assert.strictEqual(typeof Marionette.setDataApi, 'function', `${file} setDataApi export`);
  const Application = Marionette.Application.extend({
    initialize() {
      this.initialized = true;
    },
  });
  const application = new Application({
    channelName: `dist-${file}`,
    state: { ready: true },
  });
  const state = application.getState();
  assert.strictEqual(application.initialized, true, `${file} Application.extend behavior`);
  assert.strictEqual(application.getState().ready, true, `${file} Application state behavior`);
  assert.strictEqual(
    application.getChannel(),
    Marionette.Radio.channel(`dist-${file}`),
    `${file} Application Radio behavior`,
  );
  await application.destroy();
  assert.strictEqual(application.isDestroyed(), true, `${file} Application destroy behavior`);
  assert.strictEqual(state.ready, true, `${file} borrowed Application state survives teardown`);
  validateRadio(Marionette, file);
  validateRequestBoundary(Marionette, file);
  validateCollectionTemplateData(Marionette, file);
  validateRegionDisplayInput(Marionette, file);
  assert.strictEqual(Marionette.noConflict(), Marionette, `${file} noConflict return value`);
  assert.strictEqual(context.Marionette, previousMarionette, `${file} noConflict restoration`);
}

async function validate() {
  const entrypoints = [
    ['CommonJS', require(resolve(packageRoot, 'dist/marionette.cjs'))],
    ['ES module', await import(pathToFileURL(resolve(packageRoot, 'dist/marionette.js')))],
  ];

  for (const [name, Marionette] of entrypoints) {
    assert.strictEqual(Marionette.VERSION, packageJson.version, `${name} version`);
    assert.strictEqual(typeof Marionette.MarionetteError, 'function', `${name} MarionetteError export`);
    assert.strictEqual(Object.hasOwn(Marionette, 'State'), false, `${name} State absence`);
    assert.strictEqual(typeof Marionette.StateApi, 'object', `${name} StateApi export`);
    assert.strictEqual(typeof Marionette.setStateApi, 'function', `${name} setStateApi export`);
    assert.strictEqual(typeof Marionette.DataApi, 'object', `${name} DataApi export`);
    assert.strictEqual(typeof Marionette.setDataApi, 'function', `${name} setDataApi export`);
    assert.strictEqual(Marionette.View.prototype.Data, Marionette.DataApi, `${name} plain View DataApi`);
    assert.strictEqual(
      Marionette.CollectionView.prototype.Data,
      Marionette.DataApi,
      `${name} plain CollectionView DataApi`,
    );
    const plainModel = { name: 'plain' };
    assert.strictEqual(Marionette.DataApi.key(plainModel), plainModel, `${name} plain identity`);
    assert.strictEqual(Marionette.DataApi.get(plainModel, 'name'), 'plain', `${name} plain read`);
    assert.strictEqual(Marionette.DataApi.models([plainModel])[0], plainModel, `${name} plain models`);
    assert.strictEqual(Marionette.DataApi.items, undefined, `${name} removed DataApi.items`);
    const state = { ready: true };
    assert.strictEqual(new Marionette.MnObject({ state }).getState(), state, `${name} exact state source`);
    validateRadio(Marionette, name);
    validateRequestBoundary(Marionette, name);
    validateCollectionTemplateData(Marionette, name);
    validateRegionDisplayInput(Marionette, name);

    for (const utilityName of removedRootUtilities) {
      assert.strictEqual(Object.hasOwn(Marionette, utilityName), false, `${name} ${utilityName} absence`);
    }

    const object = new Marionette.MnObject();

    assert.throws(
      () => object.bindEvents({}, 'invalid'),
      error => error instanceof Marionette.MarionetteError &&
        error.code === 'MN0009' && error.message === 'Bindings must be an object.',
      `${name} error path`,
    );
  }

  await validateBrowserGlobal('marionette.umd.js');
  await validateBrowserGlobal('marionette.min.js');
}

validate();
