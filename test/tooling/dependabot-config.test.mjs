import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { matchesGlob, resolve } from 'node:path';
import test from 'node:test';
import { parseDocument } from 'yaml';

const root = resolve(import.meta.dirname, '../..');
const readJson = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const document = parseDocument(await readFile(resolve(root, '.github/dependabot.yml'), 'utf8'), { uniqueKeys: true });
assert.deepEqual(document.errors, [], 'Dependabot configuration must be valid YAML without duplicate keys');
const configuration = document.toJS();
const npmUpdates = configuration.updates.filter(update => update['package-ecosystem'] === 'npm');
const directories = update => update.directories ?? [update.directory];
const policiesFor = directory => npmUpdates.filter(update =>
  directories(update).some(pattern => matchesGlob(directory, pattern)));
const ignoresBackbone = update => (update.ignore ?? []).some(rule =>
  matchesGlob('backbone', rule['dependency-name']) && !rule.versions && !rule['update-types']);
const floorDirectory = '/test/fixtures/backbone-adapter';
// Dependabot patterns use '*' for package names, including scoped names.
const matchesName = (name, pattern) => new RegExp(`^${pattern.split('*').map(RegExp.escape).join('.*')}$`).test(name);
const matchesGroup = (group, name, updateType, appliesTo = 'version-updates') =>
  (group['applies-to'] ?? 'version-updates') === appliesTo &&
  (group['dependency-type'] ?? 'development') === 'development' &&
  (!group['update-types'] || group['update-types'].includes(updateType)) &&
  (group.patterns ?? ['*']).some(pattern => matchesName(name, pattern)) &&
  !(group['exclude-patterns'] ?? []).some(pattern => matchesName(name, pattern));
const groupFor = (policy, name, updateType, appliesTo) => Object.entries(policy.groups)
  .find(([, group]) => matchesGroup(group, name, updateType, appliesTo))?.[0];

test('certification pins route separately from routine tooling and remain eligible for security updates', async() => {
  const performance = await readJson('config/performance.json');
  const profile = await readJson('config/release-profile.json');
  const consumer = await readJson('benchmarks/consumer-bundles/contract.json');
  const certifiedNames = [...new Set([
    ...Object.keys(performance.toolchain.lockedDependencies),
    profile.browsers.playwright.package,
    ...Object.keys(consumer.toolchain).map(name => name === 'rollupPluginTerser' ? '@rollup/plugin-terser' : name),
  ])];
  for (const [directory, manifestPath, certificationGroup, routineGroup, routineName, securityGroup] of [
    ['/', 'package.json', 'certification-toolchain', 'tooling-updates', 'eslint-plugin-jsdoc', 'root-security'],
    ['/packages/html', 'packages/html/package.json', 'html-certification-toolchain', 'html-tooling', 'typescript', 'html-security'],
  ]) {
    const policy = policiesFor(directory)[0];
    const manifest = await readJson(manifestPath);
    const applicablePins = certifiedNames.filter(name => name in manifest.devDependencies);
    assert.deepEqual(policy.groups[certificationGroup].patterns.toSorted(), applicablePins.toSorted());
    assert.deepEqual(policy.groups[routineGroup]['exclude-patterns'].toSorted(), applicablePins.toSorted());
    for (const name of applicablePins) {
      for (const updateType of ['patch', 'minor', 'major']) {
        assert.equal(groupFor(policy, name, updateType), certificationGroup, `${directory}: ${name} ${updateType}`);
        assert.equal(matchesGroup(policy.groups[routineGroup], name, updateType), false);
        assert.equal(groupFor(policy, name, updateType, 'security-updates'), securityGroup);
      }
    }
    for (const updateType of ['patch', 'minor']) {
      assert.equal(groupFor(policy, routineName, updateType), routineGroup);
      assert.equal(matchesGroup(policy.groups[certificationGroup], routineName, updateType), false);
    }
    assert.equal(groupFor(policy, routineName, 'patch', 'security-updates'), securityGroup);
  }
  assert.equal(groupFor(policiesFor('/')[0], '@rollup/plugin-babel', 'patch'), 'tooling-updates');
  assert.equal(groupFor(policiesFor('/')[0], '@typescript-eslint/parser', 'patch'), 'typescript-eslint');
});

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

test('version-update queues stay small without disabling an update policy', () => {
  assert.deepEqual(configuration.updates.map(update => ({
    ecosystem: update['package-ecosystem'],
    directories: directories(update),
    limit: update['open-pull-requests-limit'],
  })), [
    { ecosystem: 'npm', directories: ['/'], limit: 2 },
    { ecosystem: 'npm', directories: npmUpdates.find(update => update.directories).directories, limit: 2 },
    { ecosystem: 'npm', directories: [floorDirectory], limit: 1 },
    { ecosystem: 'npm', directories: ['/packages/html'], limit: 2 },
    { ecosystem: 'github-actions', directories: ['/'], limit: 1 },
  ]);
});

test('consumer jsdom majors share a named group without bundling unrelated majors', () => {
  const consumerPolicy = policiesFor('/test/fixtures/esm-node')[0];
  assert.deepEqual(consumerPolicy.groups['consumer-jsdom-major'], {
    patterns: ['jsdom'],
    'update-types': ['major'],
  });
  assert.deepEqual(consumerPolicy.groups['consumer-dependencies'], {
    patterns: ['*'],
    'update-types': ['minor', 'patch'],
  });
  for (const update of configuration.updates) {
    for (const group of Object.values(update.groups)) {
      assert.equal(group['group-by'], undefined, 'Avoid dynamic subgroup refresh failures until upstream fixes them');
    }
  }
});

test('each update scope groups security fixes separately without a semver restriction', () => {
  for (const update of configuration.updates) {
    const securityGroups = Object.values(update.groups).filter(group => group['applies-to'] === 'security-updates');
    assert.deepEqual(securityGroups, [{ 'applies-to': 'security-updates', patterns: ['*'] }]);
    assert.equal(update['target-branch'], undefined, 'Security updates must retain the default branch');
    assert.equal(update.cooldown, undefined, 'Do not add an update delay');
  }
});

test('release and compatibility dependency holds remain explicit', () => {
  const majorHold = name => ({ 'dependency-name': name, 'update-types': ['version-update:semver-major'] });
  const allUpdatesHold = name => ({ 'dependency-name': name });
  assert.deepEqual(policiesFor('/')[0].ignore, [
    allUpdatesHold('marionette'), allUpdatesHold('@mnjs/*'), majorHold('@babel/*'), majorHold('typescript'),
  ]);
  assert.deepEqual(policiesFor('/test/fixtures/esm-node')[0].ignore, [
    allUpdatesHold('marionette'), allUpdatesHold('@mnjs/*'), majorHold('typescript'), majorHold('typescript-7'),
  ]);
  assert.deepEqual(policiesFor(floorDirectory)[0].ignore, [allUpdatesHold('backbone')]);
  assert.deepEqual(policiesFor('/packages/html')[0].ignore, [
    allUpdatesHold('marionette'), allUpdatesHold('lit-html'), majorHold('typescript'),
  ]);
});
