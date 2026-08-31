import assert from 'assert';
import * as Mn from 'marionette';

assert.strictEqual(typeof Mn.View, 'function');
assert.strictEqual(typeof Mn.MnObject, 'function');
assert.strictEqual(Object.prototype.hasOwnProperty.call(Mn, 'default'), false);

for (const utilityName of [
  'bindEvents',
  'unbindEvents',
  'bindRequests',
  'unbindRequests',
  'mergeOptions',
  'getOption',
  'normalizeMethods',
  'triggerMethod',
]) {
  assert.strictEqual(Object.hasOwn(Mn, utilityName), false);
}

for (const property of ['Channel', 'log', 'debugLog', '_channels']) {
  assert.strictEqual(Object.hasOwn(Mn.Radio, property), false);
}
