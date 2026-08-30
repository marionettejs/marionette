import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const fixtureRoot = import.meta.dirname;
const packageJson = JSON.parse(readFileSync(resolve(fixtureRoot, 'node_modules/marionette/package.json')));

assert.equal(existsSync(resolve(fixtureRoot, 'node_modules/underscore')), false);
assert.equal(Object.hasOwn(packageJson.peerDependencies, 'underscore'), false);

const cjs = require('marionette');
const esm = await import('marionette');

assert.equal(typeof cjs.View, 'function');
assert.equal(typeof esm.View, 'function');
