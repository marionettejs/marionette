import assert from 'assert';
import * as Mn from 'marionette';

assert.strictEqual(typeof Mn.View, 'function');
assert.strictEqual(typeof Mn.MnObject, 'function');
assert.strictEqual(Object.prototype.hasOwnProperty.call(Mn, 'default'), false);
