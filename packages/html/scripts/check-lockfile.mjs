import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url)));
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
assert.equal(lock.version, manifest.version);
assert.equal(lock.packages[''].version, manifest.version);
assert.deepEqual(lock.packages[''].devDependencies, manifest.devDependencies);
assert.deepEqual(lock.packages[''].dependencies, manifest.dependencies);
for (const [path, entry] of Object.entries(lock.packages)) {
  if (!path || entry.link) continue;
  assert.ok(typeof entry.version === 'string' && entry.version.length > 0,
    `${path}: missing version, including optional platform dependencies`);
  assert.ok(entry.resolved?.startsWith('https://registry.npmjs.org/'), `${path}: missing registry resolution`);
  assert.ok(entry.integrity?.startsWith('sha512-'), `${path}: missing pinned integrity`);
}
const rollup = lock.packages['node_modules/rollup'];
for (const [name, version] of Object.entries(rollup.optionalDependencies)) {
  const entry = lock.packages[`node_modules/rollup/node_modules/${name}`] ?? lock.packages[`node_modules/${name}`];
  assert.ok(entry, `Missing optional Rollup package ${name}`);
  if (name.startsWith('@rollup/')) assert.equal(entry.version, version, name);
}
console.log('Lockfile versions, integrity and all Rollup platform dependencies verified.');
