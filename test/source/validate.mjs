import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { rollup } from 'rollup';
import compile from '../../build/babel.js';

import BackboneApi from '../../packages/adapters/src/backbone-api.js';
import * as Marionette from '../../src/index.js';

const dom = new JSDOM('<!doctype html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const { default: jqueryDomApi } = await import('../../packages/adapters/src/dom/jquery.js');

assert.equal(typeof Marionette.View, 'function');
assert.equal(typeof Marionette.Region, 'function');
assert.equal(Object.hasOwn(Marionette, 'State'), false);
assert.equal(typeof Marionette.StateApi, 'object');
assert.equal(typeof Marionette.setStateApi, 'function');
assert.equal(typeof Marionette.DataApi, 'object');
assert.equal(typeof Marionette.setDataApi, 'function');
assert.equal(typeof Marionette.MarionetteError, 'function');
const plainState = { ready: true };
assert.equal(new Marionette.MnObject({ state: plainState }).getState(), plainState);
assert.ok(new Marionette.MarionetteError({ message: 'fixture' }) instanceof Error);
assert.equal(typeof BackboneApi.observeCollection, 'function');
assert.equal(typeof jqueryDomApi.findEl, 'function');
assert.equal(typeof jqueryDomApi.setContents, 'function');
assert.equal(typeof jqueryDomApi.wrapEl, 'function');

const root = resolve(import.meta.dirname, '../..');
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json')));
const adaptersPackageJson = JSON.parse(readFileSync(resolve(root, 'packages/adapters/package.json')));
const nonDeclarativeConfigFiles = readdirSync(resolve(root, 'config'), { recursive: true })
  .filter(file => statSync(resolve(root, 'config', file)).isFile())
  .filter(file => !file.endsWith('.json'));
const productionFiles = ['build/version.js'];
const underscoreImport = /(?:\bfrom\s+|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)['"]underscore(?:\/[^'"]*)?['"]/;
const backboneImport = /(?:\bfrom\s+|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)['"]backbone(?:\/[^'"]*)?['"]/;
const knownBackboneDataAccess = /\bmodel\.(?:attributes|cid|get)\b|\bcollection\.(?:indexOf|models)\b|\boptions\.changes\b/;

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

for (const source of [
  'import Backbone from \'backbone\';',
  'await import("backbone/modules/model.js");',
  'require("backbone");',
]) {
  assert.match(source, backboneImport);
}

for (const source of ['const packageName = \'backbone\';', 'import \'./backbone.js\';']) {
  assert.doesNotMatch(source, backboneImport);
}

for (const source of [
  'model.attributes',
  'model.cid',
  'model.get("name")',
  'collection.indexOf(model)',
  'collection.models',
  'options.changes',
]) {
  assert.match(source, knownBackboneDataAccess);
}

for (const source of ['Data.get(model, "name")', 'Data.models(collection)', 'change.updated']) {
  assert.doesNotMatch(source, knownBackboneDataAccess);
}

for (const file of readdirSync(resolve(root, 'src'), { recursive: true })) {
  if (/\.[jt]s$/.test(file)) {
    productionFiles.push(`src/${file}`);
  }
}

assert.equal(Object.hasOwn(packageJson.peerDependencies || {}, 'underscore'), false);
assert.equal(Object.hasOwn(packageJson.peerDependencies || {}, 'backbone'), false);
assert.equal(Object.hasOwn(packageJson.dependencies || {}, 'backbone'), false);
assert.equal(Object.hasOwn(packageJson.peerDependencies || {}, 'jquery'), false);
assert.equal(Object.hasOwn(packageJson.dependencies || {}, 'jquery'), false);
assert.equal(Marionette.VERSION, packageJson.version);
assert.equal(adaptersPackageJson.version, packageJson.version);
assert.equal(adaptersPackageJson.peerDependencies.marionette, packageJson.version);
assert.deepEqual(nonDeclarativeConfigFiles, []);

const regionBundle = await rollup({
  input: resolve(root, 'src/modules/region.js'),
  plugins: [compile()],
});
const regionDependencies = regionBundle.watchFiles.map(file => relative(root, file));
await regionBundle.close();
assert.equal(
  regionDependencies.includes('src/modules/view.js'),
  false,
  'Region must remain independent from View'
);
assert.equal(
  regionDependencies.includes('src/modules/common/build-region.js'),
  false,
  'Region must remain independent from the declarative Region builder'
);

for (const file of productionFiles) {
  assert.doesNotMatch(
    readFileSync(resolve(root, file), 'utf8'),
    underscoreImport
  );
}

for (const file of productionFiles) {
  assert.doesNotMatch(
    readFileSync(resolve(root, file), 'utf8'),
    backboneImport,
    `${file} must not import Backbone`
  );
}

for (const file of productionFiles) {
  assert.doesNotMatch(
    readFileSync(resolve(root, file), 'utf8'),
    knownBackboneDataAccess,
    `${file} must not use known Backbone data access patterns outside DataApi`
  );
}

assert.doesNotMatch(readFileSync(resolve(root, 'rollup.config.mjs'), 'utf8'), /\bunderscore\b/);
