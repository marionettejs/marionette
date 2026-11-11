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
  assert.ok(typeof entry.integrity === 'string' && /^sha512-[A-Za-z0-9+/]{86}==$/.test(entry.integrity) &&
    Buffer.from(entry.integrity.slice(7), 'base64').toString('base64') === entry.integrity.slice(7),
  `${path}: invalid pinned SHA-512 integrity`);
}
const rollup = lock.packages['node_modules/rollup'];
for (const [name, version] of Object.entries(rollup.optionalDependencies)) {
  const entry = lock.packages[`node_modules/rollup/node_modules/${name}`] ?? lock.packages[`node_modules/${name}`];
  assert.ok(entry, `Missing optional Rollup package ${name}`);
  if (name.startsWith('@rollup/')) assert.equal(entry.version, version, name);
}
console.log('Lockfile version presence, registry resolutions and integrity verified; all Rollup optional dependencies present and @rollup platform versions matched.');
