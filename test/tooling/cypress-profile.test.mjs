import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseDocument } from 'yaml';
import { cypressProfile } from '../examples/cypress-profile.mjs';

const manifest = JSON.parse(readFileSync(new URL('../../packages/test/examples/package.json', import.meta.url)));
const lock = JSON.parse(readFileSync(new URL('../../packages/test/examples/package-lock.json', import.meta.url)));

test('the current profile follows the exact locked examples version', () => {
  assert.deepEqual(cypressProfile('current', manifest, lock), { version: manifest.devDependencies.cypress, floor: false });
  const updatedManifest = structuredClone(manifest);
  const updatedLock = structuredClone(lock);
  updatedManifest.devDependencies.cypress = '16.4.0';
  updatedLock.packages[''].devDependencies.cypress = '16.4.0';
  updatedLock.packages['node_modules/cypress'].version = '16.4.0';
  assert.deepEqual(cypressProfile('current', updatedManifest, updatedLock), { version: '16.4.0', floor: false });
});

test('the Cypress 14 profile selects both its version and verification mode', () => {
  assert.deepEqual(cypressProfile('14.0.0', manifest, lock), { version: '14.0.0', floor: true });
  assert.deepEqual(cypressProfile('14.0.0', manifest, lock, true), { version: '14.0.0', floor: true });
  assert.throws(() => cypressProfile('current', manifest, lock, true), /profile and floor flag must agree/);
});

test('profile validation rejects unchecked versions even when both lock entries agree', () => {
  for (const profile of [undefined, '', '16.3.0', 'latest', 'current;exit 0']) {
    assert.throws(() => cypressProfile(profile, manifest, lock), /Choose the current or Cypress 14\.0\.0 profile/);
  }
  for (const version of ['latest', '^16.3.0', 'npm:cypress@16.3.0', '16.3.0;exit 0', '16.3.0\n', '016.3.0', 16]) {
    const changedManifest = structuredClone(manifest);
    const changedLock = structuredClone(lock);
    changedManifest.devDependencies.cypress = version;
    changedLock.packages[''].devDependencies.cypress = version;
    changedLock.packages['node_modules/cypress'].version = version;
    assert.throws(() => cypressProfile('current', changedManifest, changedLock), {
      message: typeof version === 'string' ? /^Cypress must use an exact release version\.$/ : /^The examples must declare Cypress\./,
    });
  }
});

test('profile validation distinguishes manifest and installed-package lock drift', () => {
  const rootDrift = structuredClone(lock);
  rootDrift.packages[''].devDependencies.cypress = '0.0.0';
  assert.throws(() => cypressProfile('current', manifest, rootDrift), /manifest and root lock entry must agree/);
  const packageDrift = structuredClone(lock);
  packageDrift.packages['node_modules/cypress'].version = '0.0.0';
  assert.throws(() => cypressProfile('current', manifest, packageDrift), /locked Cypress package must match/);
});

test('the hosted lane has one profile field and provisions inside the packed consumer', () => {
  const workflow = parseDocument(readFileSync(new URL('../../.github/workflows/test-helpers.yml', import.meta.url), 'utf8')).toJS();
  assert.deepEqual(workflow.jobs.cypress.strategy.matrix.include, [{ cypress: 'current' }, { cypress: '14.0.0' }]);
  const step = workflow.jobs.cypress.steps.find(candidate => candidate.name === 'Verify packed helper with Cypress and failure probes');
  assert.deepEqual(step.env, { MNJS_TEST_CYPRESS_PROFILE: '${{ matrix.cypress }}' });
  assert.equal(step.run, 'npm run test:helpers:consumer -- --cypress --install-cypress');
});
