import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, test } from 'node:test';
import { publishDraftRelease } from '../../scripts/release/github-release.mjs';
import { decideNpmActions } from '../../scripts/release/npm-actions.mjs';

const root = resolve(import.meta.dirname, '../..');
const temporaryDirectories = [];

after(async function() {
  await Promise.all(temporaryDirectories.map(directory => rm(directory, {
    force: true,
    recursive: true,
  })));
});

async function createArtifactDirectory(evidence, withChecksum = false) {
  const directory = await mkdtemp(join(tmpdir(), 'marionette-release-test-'));
  temporaryDirectories.push(directory);
  const evidenceText = `${JSON.stringify(evidence, null, 2)}\n`;
  await writeFile(resolve(directory, 'release-evidence.json'), evidenceText);
  if (withChecksum) {
    const checksum = createHash('sha512').update(evidenceText).digest('hex');
    await writeFile(
      resolve(directory, 'release-evidence.sha512'),
      `${checksum}  release-evidence.json\n`,
    );
  }
  return directory;
}

function runScript(file, args) {
  return spawnSync(process.execPath, [resolve(root, file), ...args], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
}

test('release artifact verification rejects Windows drive-relative names', async function() {
  const artifactDirectory = await createArtifactDirectory({
    schemaVersion: 2,
    packages: [
      {
        id: 'core',
        name: 'marionette',
        tarball: { file: 'C:evil.tgz' },
      },
      {
        id: 'data',
        name: '@marionette/data',
        tarball: { file: 'data.tgz' },
      },
      {
        id: 'adapters',
        name: '@marionette/adapters',
        tarball: { file: 'adapters.tgz' },
      },
    ],
  }, true);

  const result = runScript('scripts/release/verify-artifact.mjs', [
    '--artifact-dir',
    artifactDirectory,
  ]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Release artifact must use a contained file name: C:evil\.tgz/);
});

test('release artifact verification binds package ids to names', async function() {
  const artifactDirectory = await createArtifactDirectory({
    schemaVersion: 2,
    packages: [
      { id: 'core', name: '@marionette/data' },
      { id: 'data', name: 'marionette' },
      { id: 'adapters', name: '@marionette/adapters' },
    ],
  }, true);

  const result = runScript('scripts/release/verify-artifact.mjs', [
    '--artifact-dir',
    artifactDirectory,
  ]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /core package name mismatch/);
});

test('release target checks bind package ids to names before network access', async function() {
  const artifactDirectory = await createArtifactDirectory({
    schemaVersion: 2,
    packages: [
      { id: 'core', name: '@marionette/data' },
      { id: 'data', name: 'marionette' },
      { id: 'adapters', name: '@marionette/adapters' },
    ],
  });

  const result = runScript('scripts/release/check-targets.mjs', [
    '--artifact-dir',
    artifactDirectory,
  ]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unexpected core package name/);
});

test('npm publication decisions cover every release package', function() {
  const decisions = decideNpmActions([
    { packageEvidence: { id: 'core' }, packageName: 'marionette', state: 'exact' },
    { packageEvidence: { id: 'data' }, packageName: '@marionette/data', state: 'available' },
    { packageEvidence: { id: 'adapters' }, packageName: '@marionette/adapters', state: 'available' },
  ]);

  assert.deepEqual(decisions, [
    { name: 'core_npm_action', value: 'skip' },
    { name: 'data_npm_action', value: 'publish' },
    { name: 'adapters_npm_action', value: 'publish' },
  ]);
});

test('npm publication decisions reject conflicting package integrity', function() {
  assert.throws(() => decideNpmActions([
    { packageEvidence: { id: 'core' }, packageName: 'marionette', state: 'exact' },
    { packageEvidence: { id: 'adapters' }, packageName: '@marionette/adapters', state: 'conflict' },
  ]), /@marionette\/adapters exists with different integrity/);
});

test('GitHub release planning rejects Windows drive-relative names', async function() {
  const artifactDirectory = await createArtifactDirectory({
    schemaVersion: 2,
    packages: [
      {
        id: 'core',
        name: 'marionette',
        tarball: { file: 'C:evil.tgz' },
        manifestReport: { file: 'core-package-manifest.json' },
      },
      {
        id: 'data',
        name: '@marionette/data',
        tarball: { file: 'data.tgz' },
        manifestReport: { file: 'data-package-manifest.json' },
      },
      {
        id: 'adapters',
        name: '@marionette/adapters',
        tarball: { file: 'adapters.tgz' },
        manifestReport: { file: 'adapters-package-manifest.json' },
      },
    ],
    reports: {
      bundle: {
        file: 'bundle-report.json',
      },
    },
  });

  const result = runScript('scripts/release/publish-github.mjs', [
    '--mode',
    'dry-run',
    '--artifact-dir',
    artifactDirectory,
  ]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Release artifact must use a contained file name: C:evil\.tgz/);
});

test('tag validation failure prevents a draft from becoming public', function() {
  const tagError = new Error('tag conflict');
  let editCalled = false;

  assert.throws(() => publishDraftRelease({
    editArgs: ['release', 'edit', 'v5.0.0'],
    ensureTag() {
      throw tagError;
    },
    run() {
      editCalled = true;
    },
  }), error => error === tagError);
  assert.equal(editCalled, false);
});

test('a verified tag is followed by the public release edit', function() {
  const calls = [];
  const editArgs = ['release', 'edit', 'v5.0.0', '--draft=false'];

  publishDraftRelease({
    editArgs,
    ensureTag() {
      calls.push('tag');
    },
    verifyAssets() {
      calls.push('assets');
    },
    run(args) {
      calls.push(args);
    },
  });

  assert.deepEqual(calls, ['assets', 'tag', editArgs]);
});

test('a failed public release edit propagates after tag validation', function() {
  const editError = new Error('release edit failed');
  let tagValidated = false;

  assert.throws(() => publishDraftRelease({
    editArgs: ['release', 'edit', 'v5.0.0', '--draft=false'],
    ensureTag() {
      tagValidated = true;
    },
    run() {
      throw editError;
    },
  }), error => error === editError);
  assert.equal(tagValidated, true);
});

test('an asset revalidation failure prevents a draft from becoming public', function() {
  const assetError = new Error('artifact changed');
  let editCalled = false;
  let tagCreated = false;

  assert.throws(() => publishDraftRelease({
    editArgs: ['release', 'edit', 'v5.0.0', '--draft=false'],
    ensureTag() {
      tagCreated = true;
    },
    verifyAssets() {
      throw assetError;
    },
    run() {
      editCalled = true;
    },
  }), error => error === assetError);
  assert.equal(tagCreated, false);
  assert.equal(editCalled, false);
});
