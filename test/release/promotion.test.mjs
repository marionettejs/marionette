import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, test } from 'node:test';
import { publishDraftRelease } from '../../scripts/release/github-release.mjs';

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
    schemaVersion: 1,
    package: {
      tarball: {
        file: 'C:evil.tgz',
      },
    },
  }, true);

  const result = runScript('scripts/release/verify-artifact.mjs', [
    '--artifact-dir',
    artifactDirectory,
  ]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Release artifact must use a contained file name: C:evil\.tgz/);
});

test('GitHub release planning rejects Windows drive-relative names', async function() {
  const artifactDirectory = await createArtifactDirectory({
    package: {
      tarball: {
        file: 'C:evil.tgz',
      },
    },
    reports: {
      bundle: {
        file: 'bundle-report.json',
      },
      packageManifest: {
        file: 'package-manifest.json',
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
    run(args) {
      calls.push(args);
    },
  });

  assert.deepEqual(calls, ['tag', editArgs]);
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
