import getValue from '../tmp/typed-core/src/utils/get-value.js';

const object = {
  value: 'example',
  method(this: { value: string }) { return this.value; },
};
const direct: unknown = getValue(object, 'value');
const invoked: unknown = getValue(object, 'method');
const absent: unknown = getValue();
getValue(null);
getValue(undefined, null);
getValue('abc', 'length');
getValue(0, 'valueOf');
getValue(false, 'valueOf');
getValue(0n, 'valueOf');
getValue(Symbol('object'), 'description');
const symbol = Symbol('key');
getValue({ [symbol]: 'value' }, symbol);
getValue({ 1: 'value' }, 1);
getValue({ true: 'value' }, true);
getValue({ null: 'value' }, null);
getValue({ undefined: 'value' });
getValue({ key: 'value' }, { toString() { return 'key'; } });
getValue(function named() {}, 'name');
getValue(null, 'missing', function(this: null) { return this; });
getValue(undefined, 'missing', function(this: undefined) { return this; });
getValue({}, 'missing', false);
getValue.call(null, object, 'value');
// @ts-expect-error Dynamic property resolution does not promise a string.
const promisedValue: string = getValue(object, 'value');
// @ts-expect-error A dynamically selected callable result remains unknown.
const promisedResult: string = getValue(object, 'method');
// @ts-expect-error Fallback handling does not infer a result type.
const promisedFallback: number = getValue(null, 'missing', 1);
// @ts-expect-error The helper has no explicit result-type escape hatch.
getValue<string>(object, 'value');
