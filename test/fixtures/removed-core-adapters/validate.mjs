import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

for (const subpath of ['marionette/backbone', 'marionette/jquery-dom-api']) {
  await assert.rejects(import(subpath), error => error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED');
  assert.throws(() => require(subpath), error => error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED');
}
