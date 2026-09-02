import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

import Backbone from '../../backbone.js';
import * as Marionette from '../../index.js';

const dom = new JSDOM('<!doctype html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const { default: jqueryDomApi } = await import('../../jquery-dom-api.js');

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
assert.equal(Backbone.Model.prototype.triggerMethod, Marionette.Events.triggerMethod);
assert.equal(typeof jqueryDomApi.findEl, 'function');
assert.equal(typeof jqueryDomApi.setContents, 'function');
assert.equal(typeof jqueryDomApi.wrapEl, 'function');

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

for (const source of ['Data.get(model, "name")', 'Data.items(collection)', 'change.updated']) {
  assert.doesNotMatch(source, knownBackboneDataAccess);
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
assert.equal(packageJson.peerDependencies.backbone, '^1.4.0');
assert.equal(packageJson.peerDependenciesMeta.backbone.optional, true);
assert.equal(Object.hasOwn(packageJson.dependencies || {}, 'backbone'), false);
assert.equal(packageJson.peerDependencies.jquery, '^4.0.0');
assert.equal(packageJson.peerDependenciesMeta.jquery.optional, true);
assert.equal(Object.hasOwn(packageJson.dependencies || {}, 'jquery'), false);
assert.deepEqual(nonDeclarativeConfigFiles, []);

for (const file of productionFiles) {
  assert.doesNotMatch(
    readFileSync(resolve(root, file), 'utf8'),
    underscoreImport
  );
}

for (const file of productionFiles.filter(candidate => candidate !== 'backbone.js')) {
  assert.doesNotMatch(
    readFileSync(resolve(root, file), 'utf8'),
    backboneImport,
    `${file} must not import Backbone`
  );
}

for (const file of productionFiles.filter(candidate =>
  candidate !== 'backbone.js' && candidate !== 'runtime/backbone-data-api.js')) {
  assert.doesNotMatch(
    readFileSync(resolve(root, file), 'utf8'),
    knownBackboneDataAccess,
    `${file} must not use known Backbone data access patterns outside DataApi`
  );
}

assert.doesNotMatch(readFileSync(resolve(root, 'rollup.config.mjs'), 'utf8'), /\bunderscore\b/);
