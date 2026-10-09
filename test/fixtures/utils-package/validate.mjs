import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as Marionette from 'marionette';
import * as utils from '@mnjs/utils';

const require = createRequire(import.meta.url);
for (const [core, shared] of [
  [Marionette, utils],
  [require('marionette'), require('@mnjs/utils')]
]) {
  assert.equal(core.MarionetteError, shared.MarionetteError);
  assert.equal(core.extend, shared.extend);
  const component = {
    options: { label: 'example' },
    handle() { return 'handled'; },
    trigger(name, value) { this.lastEvent = [name, value]; },
    onReady(value) { return value; }
  };
  const handlers = shared.normalizeMethods.call(component, { ready: 'handle' });
  assert.equal(handlers.ready, component.handle);
  assert.equal(shared.getOption.call(component, 'label'), 'example');
  shared.mergeOptions.call(component, { label: 'merged', other: 'ignored' }, ['label']);
  assert.equal(component.label, 'merged');
  assert.equal(component.other, undefined);
  assert.equal(shared.triggerMethod.call(component, 'ready', 42), 42);
  assert.deepEqual(component.lastEvent, ['ready', 42]);
  assert.throws(() => shared.normalizeMethods.call(component, { ready: 'missing' }),
    error => error instanceof core.MarionetteError && error.code === 'MN0019');
  assert.equal(Object.hasOwn(core, 'normalizeMethods'), false);
}
console.log('Packed utils: ESM and CommonJS exports, component methods, and shared error identity passed');
