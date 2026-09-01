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
  assert.strictEqual(typeof Marionette.State, 'function', `${file} State export`);
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
  assert.strictEqual(application.getState().get('ready'), true, `${file} Application State behavior`);
  assert.strictEqual(
    application.getChannel(),
    Marionette.Radio.channel(`dist-${file}`),
    `${file} Application Radio behavior`,
  );
  await application.destroy();
  assert.strictEqual(application.isDestroyed(), true, `${file} Application destroy behavior`);
  assert.strictEqual(state.isDestroyed(), true, `${file} Application State teardown`);
  validateRadio(Marionette, file);
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
    assert.strictEqual(typeof Marionette.State, 'function', `${name} State export`);
    assert.strictEqual(new Marionette.State({ ready: true }).get('ready'), true, `${name} State behavior`);
    validateRadio(Marionette, name);

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
