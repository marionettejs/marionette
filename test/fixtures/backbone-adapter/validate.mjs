import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);

assert.equal(existsSync(resolve(import.meta.dirname, 'node_modules/jquery')), false);
for (const packagePath of [
  '@reduxjs/toolkit',
  '@xstate/store',
  'zustand',
]) {
  assert.equal(existsSync(resolve(import.meta.dirname, 'node_modules', packagePath)), false);
}
await assert.rejects(
  import('@marionette/adapters'),
  error => error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED',
);
assert.throws(
  () => require('@marionette/adapters'),
  error => error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED',
);
await assert.rejects(
  import('@marionette/adapters/snapshot'),
  error => error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED',
);
assert.throws(
  () => require('@marionette/adapters/snapshot'),
  error => error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED',
);
await Promise.all([
  import('@marionette/adapters/redux'),
  import('@marionette/adapters/xstate-store'),
  import('@marionette/adapters/zustand'),
]);

for (const file of [
  'validate-esm-backbone-first.mjs',
  'validate-esm-adapter-first.mjs',
  'validate-cjs-backbone-first.cjs',
  'validate-cjs-adapter-first.cjs',
]) {
  execFileSync(process.execPath, [resolve(import.meta.dirname, file)], {
    stdio: 'inherit',
    timeout: 30_000,
  });
}
