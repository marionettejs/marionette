import assert from 'node:assert/strict';

// Run in its own process: absence must survive each missing-capability probe.
// This does not supply a polyfill or certify an unsupported Node runtime.
const original = Object.getOwnPropertyDescriptor(globalThis, 'URLPattern');
const navigation = Object.getOwnPropertyDescriptor(globalThis, 'navigation');
try {
  for (const present of [false, true]) {
    if (present) { Object.defineProperty(globalThis, 'URLPattern', { configurable: true, value: undefined }); } else { delete globalThis.URLPattern; }
    const expected = Object.getOwnPropertyDescriptor(globalThis, 'URLPattern');
    await assert.rejects(import(`./capabilities-probe.mjs?descriptor=${present}`), /Successful-runtime probe requires URLPattern/);
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, 'URLPattern'), expected);
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, 'navigation'), navigation);
    assert.equal(Object.hasOwn(globalThis, 'eagerAppImports'), false);
  }
  console.log('Missing URLPattern: absent/undefined descriptors restored; success-phase prerequisite reported explicitly.');
} finally {
  if (original) { Object.defineProperty(globalThis, 'URLPattern', original); } else { delete globalThis.URLPattern; }
}
