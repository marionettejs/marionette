import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicationEnabled } from '../../scripts/release/publication.mjs';
import { fixture, successfulValidation } from './fixture.mjs';

const beta = '5.0.0-beta.1';
const policy = publication => ({ schemaVersion: 2, publication });

test('prerelease authorization permits only the named version and never stable', () => {
  const candidate = policy({ stable: false, prerelease: beta });
  assert.equal(publicationEnabled(candidate, beta), true);
  for (const version of ['5.0.0', '5.0.1', '5.0.0-beta.2', '5.0.0-alpha.3', '6.0.0-beta.1']) {
    assert.equal(publicationEnabled(candidate, version), false);
  }
});

test('stable authorization does not authorize a prerelease', () => {
  const candidate = policy({ stable: true, prerelease: null });
  assert.equal(publicationEnabled(candidate, '5.0.0'), true);
  assert.equal(publicationEnabled(candidate, beta), false);
});

test('invalid and superseded policies fail closed', () => {
  for (const candidate of [
    { schemaVersion: 1, publicationEnabled: true },
    policy({ stable: 'true', prerelease: beta }),
    policy({ stable: false, prerelease: true }),
    policy({ stable: false, prerelease: '5.0.0' }),
    policy({ stable: false }), policy(null),
  ]) {
    assert.throws(() => publicationEnabled(candidate, beta), /Invalid release publication policy/);
  }
  assert.throws(() => publicationEnabled(policy({ stable: false, prerelease: null }), undefined), /Invalid release version/);
  assert.throws(() => publicationEnabled(policy({ stable: false, prerelease: null }), 'latest'), /Invalid release version/);
});

for (const version of [beta, '5.0.0', '5.0.0-beta.2']) {
  test(`publish preflight enforces the exact prerelease authorization for ${version}`, async t => {
    const candidate = await fixture(t, { version, publication: { stable: false, prerelease: beta } });
    const result = candidate.run('preflight', ['--mode', 'publish', '--event', 'workflow_dispatch', '--ref', 'refs/heads/master']);
    assert.equal(result.status, version === beta ? 0 : 1, result.stderr);
    if (version !== beta) { assert.match(result.stderr, /publication is disabled/); }
    assert.equal(candidate.run('preflight', ['--mode', 'dry-run']).status, 0);
  });
}

test('artifact verification rejects relabeling stable as prerelease and policy tampering', async t => {
  const candidate = await fixture(t, { version: '5.0.0', publication: { stable: false, prerelease: beta } });
  await successfulValidation(candidate);
  candidate.evidence.release.prerelease = true;
  await candidate.save();
  let result = candidate.run('verify-artifact', ['--artifact-dir', candidate.artifacts]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /prerelease classification mismatch/);
  candidate.evidence.release.prerelease = false;
  candidate.evidence.promotionPolicy.publication = { stable: true, prerelease: beta };
  await candidate.save();
  result = candidate.run('verify-artifact', ['--artifact-dir', candidate.artifacts]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /publication authorization policy mismatch/);
});
