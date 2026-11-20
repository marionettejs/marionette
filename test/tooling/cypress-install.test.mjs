import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { cypressInstallArguments } from '../examples/install-cypress.mjs';

const manifest = JSON.parse(readFileSync(new URL('../../packages/test/examples/package.json', import.meta.url)));
const lock = JSON.parse(readFileSync(new URL('../../packages/test/examples/package-lock.json', import.meta.url)));

test('current Cypress installation follows the exact locked examples version', () => {
  assert.deepEqual(cypressInstallArguments('current', manifest, lock), [
    'exec', '--yes', '--ignore-scripts', `--package=cypress@${manifest.devDependencies.cypress}`,
    '--', 'cypress', 'install',
  ]);
});

test('the Cypress 14 compatibility floor remains explicit', () => {
  assert.deepEqual(cypressInstallArguments('14.0.0', manifest, lock), [
    'exec', '--yes', '--ignore-scripts', '--package=cypress@14.0.0', '--', 'cypress', 'install',
  ]);
});

test('Cypress installation rejects unchecked profiles, version specs and lock drift', () => {
  for (const profile of [undefined, '', '16.3.0', 'latest', 'current;exit 0']) {
    assert.throws(() => cypressInstallArguments(profile, manifest, lock), /profile/);
  }
  for (const version of ['latest', '^16.3.0', 'npm:cypress@16.3.0', '16.3.0;exit 0', '16.3.0\n', '016.3.0', 16]) {
    const changed = structuredClone(manifest);
    changed.devDependencies.cypress = version;
    assert.throws(() => cypressInstallArguments('current', changed, lock), /Cypress/);
  }
  for (const path of ['', 'node_modules/cypress']) {
    const changed = structuredClone(lock);
    if (path) { changed.packages[path].version = '0.0.0'; } else {
      changed.packages[path].devDependencies.cypress = '0.0.0';
    }
    assert.throws(() => cypressInstallArguments('current', manifest, changed), /Cypress/);
  }
});
