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

function validateBrowserGlobal(file) {
  const previousMarionette = {};
  const context = {
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

  validateBrowserGlobal('marionette.umd.js');
  validateBrowserGlobal('marionette.min.js');
}

validate();
