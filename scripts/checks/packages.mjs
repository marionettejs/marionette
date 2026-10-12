import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { releasePackages } from '../release/packages.mjs';
import { packageRoots } from '../api-contracts/inventory.mjs';

const root = resolve(import.meta.dirname, '../..');
const read = file => JSON.parse(readFileSync(resolve(root, file), 'utf8'));
const inventory = read('config/package-ownership.json');
const manifest = read('package.json');
const profile = read('config/release-profile.json');
assert.equal(inventory.schemaVersion, 1, 'Unsupported package ownership schema');
const entries = inventory.packages;
const actual = ['.', ...readdirSync(resolve(root, 'packages')).filter(name =>
  existsSync(resolve(root, 'packages', name, 'package.json'))).map(name => `packages/${name}`)].sort();
assert.deepEqual(entries.map(entry => entry.directory).sort(), actual, 'Every package needs an ownership entry');
assert.equal(new Set(entries.map(entry => entry.id)).size, entries.length, 'Duplicate owned package id');
assert.deepEqual(packageRoots.map(path => path || '.').sort(),
  entries.filter(entry => entry.role === 'runtime').map(entry => entry.directory).sort(),
  'Runtime API inventory must include every owned runtime package');
assert.deepEqual(entries.filter(entry => entry.stage === 'stable').map(entry => entry.id).sort(),
  releasePackages.map(entry => entry.id).sort(), 'Stable release set and development ownership must remain distinct');
for (const entry of entries) {
  assert(['runtime', 'testing'].includes(entry.role), `Invalid package role: ${entry.id}`);
  assert(['stable', 'development'].includes(entry.stage), `Invalid package stage: ${entry.id}`);
  const pkg = read(`${entry.directory}/package.json`);
  assert.equal(pkg.name, entry.name, `Owned package identity mismatch: ${entry.id}`);
  assert.equal(pkg.engines?.node, profile.source.consumerNodeRange, `Consumer floor mismatch: ${entry.id}`);
  assert(existsSync(resolve(root, entry.directory, 'license.txt')), `Missing package license: ${entry.id}`);
  assert(pkg.exports && pkg.files?.length, `Missing artifact exports or content: ${entry.id}`);
  assert(manifest.scripts[entry.buildScript], `Missing build command: ${entry.id}`);
  assert(manifest.scripts.build.includes(`npm run ${entry.buildScript}`), `Normal build omits ${entry.id}`);
  assert(entry.coverage?.includes(entry.id === 'core' ? 'src/**/*.{js,ts}' : `${entry.directory}/src/**/*.ts`),
    `Coverage omits owned production source: ${entry.id}`);
  for (const input of entry.requiredInputs || []) {
    assert(existsSync(resolve(root, input)), `Missing owned verification input for ${entry.id}: ${input}`);
  }
  if (entry.verificationScript) {
    assert(manifest.scripts[entry.verificationScript], `Missing artifact verification: ${entry.id}`);
    assert(readFileSync(resolve(root, 'scripts/checks/verify.mjs'), 'utf8').includes(`'${entry.verificationScript}'`),
      `Normal verification omits artifact consumption: ${entry.id}`);
  }
}
console.log(`Verified ${entries.length} owned packages; ${releasePackages.length} stable release targets remain unchanged.`);
