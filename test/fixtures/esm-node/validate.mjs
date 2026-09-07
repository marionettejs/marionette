import assert from 'assert';
import * as Mn from 'marionette';

assert.strictEqual(typeof Mn.View, 'function');
assert.strictEqual(typeof Mn.MnObject, 'function');
assert.strictEqual(typeof Mn.createMarionette, 'function');
assert.strictEqual(Object.prototype.hasOwnProperty.call(Mn, 'default'), false);

const isolated = Mn.createMarionette();
assert.notStrictEqual(isolated.View, Mn.View);
assert.notStrictEqual(isolated.Radio, Mn.Radio);

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

for (const property of ['Channel', 'log', 'debugLog']) {
  assert.strictEqual(typeof Mn.Radio[property], 'function');
}
assert.strictEqual(Object.hasOwn(Mn.Radio, '_channels'), false);
