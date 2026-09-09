import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicationEnabled, releaseChannel } from '../../scripts/release/publication.mjs';
import { decideNpmActions } from '../../scripts/release/npm-actions.mjs';

const beta = '5.0.0-beta.1';
const policy = publication => ({ schemaVersion: 2, publication, npm: { stableTag: 'latest', prereleaseTag: 'next' } });

test('authorization distinguishes channel, exact version, stable permission and schema', () => {
  for (const stable of [false, true]) {
    for (const prerelease of [null, beta]) {
      const candidate = policy({ stable, prerelease });
      for (const version of ['5.0.0', '5.0.1', '6.0.0']) {
        assert.equal(publicationEnabled(candidate, version), stable);
        assert.equal(releaseChannel(candidate, version), 'latest');
      }
      for (const version of [beta, '5.0.0-beta.2', '5.0.0-alpha.1', '6.0.0-beta.1']) {
        assert.equal(publicationEnabled(candidate, version), version === prerelease);
        assert.equal(releaseChannel(candidate, version), 'next');
      }
    }
  }
  for (const candidate of [
    { ...policy({ stable: true, prerelease: beta }), schemaVersion: 1 },
    policy(null), policy({ stable: 'true', prerelease: beta }),
    policy({ stable: false, prerelease: true }), policy({ stable: false }),
    policy({ stable: false, prerelease: '5.0.0' }),
  ]) {
    assert.throws(() => publicationEnabled(candidate, beta), /Invalid release publication policy/);
  }
});

test('release version grammar rejects malformed identities and accepts valid prerelease identifiers', () => {
  const candidate = policy({ stable: false, prerelease: beta });
  for (const version of [undefined, null, 5, '', 'latest', '5.0', '05.0.0', '5.00.0', '5.0.00',
    '5.0.0-beta..1', '5.0.0-beta.', '5.0.0-.beta', '5.0.0-01', '5.0.0-beta.01', '5.0.0+build']) {
    assert.throws(() => publicationEnabled(candidate, version), /Invalid release version/);
    assert.throws(() => releaseChannel(candidate, version), /Invalid release version/);
    if (version !== null) {
      assert.throws(() => publicationEnabled(policy({ stable: false, prerelease: version }), beta), /Invalid release publication policy/);
    }
  }
  for (const version of ['0.0.0-0', '5.0.0-beta.0', '5.0.0-01alpha', '5.0.0-beta-name.1']) {
    assert.equal(publicationEnabled(policy({ stable: false, prerelease: version }), version), true);
    assert.equal(releaseChannel(candidate, version), 'next');
  }
});

test('npm recovery publishes only absent versions and refuses immutable conflicts', () => {
  const states = ['available', 'exact', 'available'].map((state, index) => ({
    packageName: `package-${index}`, packageEvidence: { id: `id-${index}` }, state
  }));
  assert.deepEqual(decideNpmActions(states), [
    { name: 'id-0_npm_action', value: 'publish' },
    { name: 'id-1_npm_action', value: 'skip' },
    { name: 'id-2_npm_action', value: 'publish' },
  ]);
  for (const index of [0, 1, 2]) {
    const conflict = states.map((entry, current) => current === index ? { ...entry, state: 'conflict' } : entry);
    assert.throws(() => decideNpmActions(conflict), new RegExp(`package-${index} exists with different integrity`));
  }
});
