import nodeAssert from 'node:assert/strict';

// Only the Chai assertions used by the vendored upstream subset are adapted.
export const assert = Object.assign((value, message) => nodeAssert.ok(value, message), nodeAssert, {
  equal: nodeAssert.strictEqual,
  deepEqual: nodeAssert.deepStrictEqual,
  isTrue: (value, message) => nodeAssert.strictEqual(value, true, message),
  isFalse: (value, message) => nodeAssert.strictEqual(value, false, message),
  isUndefined: (value, message) => nodeAssert.strictEqual(value, undefined, message),
  isNotNull: (value, message) => nodeAssert.notStrictEqual(value, null, message),
  isOk: nodeAssert.ok,
  include: (values, value, message) => nodeAssert.ok(values.includes(value), message),
  oneOf: (value, values, message) => nodeAssert.ok(values.includes(value), message),
  isEmpty: (value, message) => nodeAssert.equal(value.length ?? Object.keys(value).length, 0, message),
  sameMembers: (actual, expected, message) => {
    nodeAssert.equal(actual.length, expected.length, message);
    const remaining = [...expected];
    for (const value of actual) {
      const index = remaining.indexOf(value);
      nodeAssert.ok(index >= 0, message);
      remaining.splice(index, 1);
    }
  },
});

export {stripExpressionMarkers, stripExpressionComments} from './upstream-markers.mjs';
