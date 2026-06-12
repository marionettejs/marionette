import assert from 'assert';
import { createRequire } from 'module';
import { View } from 'marionette';

const require = createRequire(import.meta.url);
const underscorePackage = require('underscore/package.json');

assert.strictEqual(underscorePackage.version, '1.13.0');
assert.strictEqual(typeof View, 'function');
