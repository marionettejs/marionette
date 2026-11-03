import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { matchesGlob, resolve } from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '../..');
const readJson = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const configuration = parse(await readFile(resolve(root, '.github/dependabot.yml'), 'utf8'));
const npmUpdates = configuration.updates.filter(update => update['package-ecosystem'] === 'npm');
const directories = update => update.directories ?? [update.directory];
const policiesFor = directory => npmUpdates.filter(update =>
  directories(update).some(pattern => matchesGlob(directory, pattern)));
const ignoresBackbone = update => (update.ignore ?? []).some(rule =>
  matchesGlob('backbone', rule['dependency-name']) && !rule.versions && !rule['update-types']);
const floorDirectory = '/test/fixtures/backbone-adapter';

test('each installed consumer fixture has exactly one Dependabot policy', async() => {
  const inventory = await readJson('config/release-validation.json');
  const consumers = [...inventory.fixtures.map(name => `/test/fixtures/${name}`), '/packages/test/examples'];
  for (const directory of consumers) {
    assert.equal(policiesFor(directory).length, 1, `${directory} needs one nonoverlapping update policy`);
  }
  const configured = npmUpdates.flatMap(directories).filter(directory =>
    directory.startsWith('/test/fixtures/') || directory === '/packages/test/examples');
  assert.deepEqual(configured.toSorted(), consumers.toSorted(), 'The explicit update inventory must cover every consumer');
});

test('only the dedicated Backbone compatibility floor ignores Backbone updates', async() => {
  const floorPolicy = policiesFor(floorDirectory)[0];
  // Primary npm filenames are directory-relative; a repository-relative exclusion
  // in a shared policy cannot protect this fixture. Give it a dedicated policy.
  assert.deepEqual(directories(floorPolicy), [floorDirectory]);
  assert.ok(ignoresBackbone(floorPolicy), 'The minimum-version fixture must keep its Backbone pin');
  const adapter = await readJson('packages/adapters/package.json');
  const floor = await readJson('test/fixtures/backbone-adapter/package.json');
  const minimum = /^\^(\d+\.\d+\.\d+)$/.exec(adapter.peerDependencies.backbone)?.[1];
  assert.ok(minimum, 'Review the fixture floor when the adapter support range changes');
  assert.equal(floor.dependencies.backbone, minimum);

  const inventory = await readJson('config/release-validation.json');
  let currentFixtures = 0;
  for (const name of inventory.fixtures.filter(candidate => `/test/fixtures/${candidate}` !== floorDirectory)) {
    const fixture = await readJson(`test/fixtures/${name}/package.json`);
    if (!(fixture.dependencies?.backbone || fixture.devDependencies?.backbone)) { continue; }
    currentFixtures++;
    assert.ok(!ignoresBackbone(policiesFor(`/test/fixtures/${name}`)[0]),
      `${name} must remain eligible for current Backbone updates`);
  }
  assert.ok(currentFixtures > 0, 'Keep current Backbone coverage alongside the isolated floor');
});
