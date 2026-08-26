import assert from 'assert';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const packageJson = require('../../package.json');

async function validate() {
  const entrypoints = [
    ['CommonJS', require('../../dist/marionette.cjs')],
    ['ES module', await import('../../dist/marionette.js')],
    ['UMD', require('../../dist/marionette.umd.js')],
    ['minified UMD', require('../../dist/marionette.min.js')],
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
}

validate();
