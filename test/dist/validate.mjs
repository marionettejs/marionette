import assert from 'assert';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import vm from 'vm';

const require = createRequire(import.meta.url);
const packageJson = require('../../package.json');

function validateBrowserGlobal(file) {
  const previousMarionette = {};
  const context = {
    Marionette: previousMarionette,
    _: require('underscore'),
  };

  vm.runInNewContext(
    readFileSync(new URL(`../../dist/${file}`, import.meta.url), 'utf8'),
    context,
    { filename: file },
  );

  const Marionette = context.Marionette;

  assert.strictEqual(Marionette.VERSION, packageJson.version, `${file} browser-global version`);
  assert.strictEqual(Marionette.noConflict(), Marionette, `${file} noConflict return value`);
  assert.strictEqual(context.Marionette, previousMarionette, `${file} noConflict restoration`);
}

async function validate() {
  const entrypoints = [
    ['CommonJS', require('../../dist/marionette.cjs')],
    ['ES module', await import('../../dist/marionette.js')],
  ];

  for (const [name, Marionette] of entrypoints) {
    assert.strictEqual(Marionette.VERSION, packageJson.version, `${name} version`);

    const object = new Marionette.MnObject();

    assert.throws(
      () => object.bindEvents({}, 'invalid'),
      error => error instanceof Error && error.message === 'Bindings must be an object.',
      `${name} error path`,
    );
  }

  validateBrowserGlobal('marionette.umd.js');
  validateBrowserGlobal('marionette.min.js');
}

validate();
