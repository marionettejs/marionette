import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import Backbone from '../../backbone.js';
import jqueryDomApi from '../../jquery-dom-api.js';
import * as Marionette from '../../index.js';

assert.equal(typeof Marionette.View, 'function');
assert.equal(typeof Marionette.Region, 'function');
assert.equal(typeof Marionette.MarionetteError, 'function');
assert.ok(new Marionette.MarionetteError({ message: 'fixture' }) instanceof Error);
assert.equal(Backbone.Model.prototype.triggerMethod, Marionette.Events.triggerMethod);
assert.equal(typeof jqueryDomApi.findEl, 'function');
assert.equal(typeof jqueryDomApi.setContents, 'function');

const root = resolve(import.meta.dirname, '../..');
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json')));
const nonDeclarativeConfigFiles = readdirSync(resolve(root, 'config'), { recursive: true })
  .filter(file => statSync(resolve(root, 'config', file)).isFile())
  .filter(file => !file.endsWith('.json'));
const productionFiles = [
  'index.js',
  'backbone.js',
  'jquery-dom-api.js',
  'build/version.js',
  'version.js',
];
const underscoreImport = /(?:\bfrom\s+|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)['"]underscore(?:\/[^'"]*)?['"]/;

for (const source of [
  'import \'underscore\';',
  'import { each } from \'underscore\';',
  'await import(\'underscore/modules/each.js\');',
  'require("underscore");',
]) {
  assert.match(source, underscoreImport);
}

for (const source of ['const packageName = \'underscore\';', 'import \'./underscore.js\';']) {
  assert.doesNotMatch(source, underscoreImport);
}

for (const file of readdirSync(resolve(root, 'runtime'), { recursive: true })) {
  if (file.endsWith('.js')) {
    productionFiles.push(`runtime/${file}`);
  }
}

for (const directory of ['modules', 'mixins', 'utils']) {
  for (const file of readdirSync(resolve(root, directory), { recursive: true })) {
    if (file.endsWith('.js')) {
      productionFiles.push(`${directory}/${file}`);
    }
  }
}

assert.equal(Object.hasOwn(packageJson.peerDependencies, 'underscore'), false);
assert.deepEqual(nonDeclarativeConfigFiles, []);

for (const file of productionFiles) {
  assert.doesNotMatch(
    readFileSync(resolve(root, file), 'utf8'),
    underscoreImport
  );
}

assert.doesNotMatch(readFileSync(resolve(root, 'rollup.config.mjs'), 'utf8'), /\bunderscore\b/);
