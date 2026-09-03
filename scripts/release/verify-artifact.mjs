import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const root = resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);

function readArgument(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) {
    return fallback;
  }

  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${name}`);
  }

  return value;
}

function sha512(buffer) {
  return createHash('sha512').update(buffer).digest('hex');
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} mismatch: received ${actual}; expected ${expected}.`);
  }
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    throw new Error(`${command} exited with status ${result.status}.`);
  }

  return result.stdout.trim();
}

async function getNpmVersion() {
  const npmExecPath = process.env.npm_execpath;
  if (!npmExecPath) {
    throw new Error('Run release:verify through npm so the npm CLI can be located.');
  }

  const npmPackagePath = resolve(dirname(npmExecPath), '..', 'package.json');
  const npmPackage = JSON.parse(await readFile(npmPackagePath, 'utf8'));
  return npmPackage.version;
}

const artifactDir = resolve(root, readArgument('--artifact-dir', 'release'));
const evidencePath = resolve(artifactDir, 'release-evidence.json');
const evidenceBytes = await readFile(evidencePath);
const evidence = JSON.parse(evidenceBytes);
if (evidence.schemaVersion !== 2) {
  throw new Error(`Unsupported evidence schemaVersion ${evidence.schemaVersion}.`);
}

function artifactPath(fileName) {
  if (typeof fileName !== 'string' || !fileName || fileName === '.' || fileName === '..' ||
      fileName.includes('/') || fileName.includes('\\') || fileName.includes(':')) {
    throw new Error(`Release artifact must use a contained file name: ${fileName}`);
  }
  return resolve(artifactDir, fileName);
}

const checksum = (await readFile(artifactPath('release-evidence.sha512'), 'utf8')).trim();
assertEqual(checksum, `${sha512(evidenceBytes)}  release-evidence.json`, 'evidence checksum');

if (!Array.isArray(evidence.packages) || evidence.packages.length !== 3) {
  throw new Error('Release evidence must contain the core, data, and adapters packages.');
}
const packageIds = evidence.packages.map(packageEvidence => packageEvidence.id);
if (JSON.stringify(packageIds) !== JSON.stringify(['core', 'data', 'adapters'])) {
  throw new Error(`Unexpected release package order: ${packageIds.join(', ')}.`);
}
const packageNames = new Map([
  ['core', 'marionette'],
  ['data', '@marionette/data'],
  ['adapters', '@marionette/adapters'],
]);
for (const packageEvidence of evidence.packages) {
  assertEqual(
    packageEvidence.name,
    packageNames.get(packageEvidence.id),
    `${packageEvidence.id} package name`,
  );
}

for (const packageEvidence of evidence.packages) {
  const label = packageEvidence.name;
  const tarballPath = artifactPath(packageEvidence.tarball.file);
  const tarball = await readFile(tarballPath);
  assertEqual(tarball.length, packageEvidence.tarball.size, `${label} tarball size`);
  assertEqual(sha256(tarball), packageEvidence.tarball.sha256, `${label} tarball SHA-256`);
  assertEqual(sha512(tarball), packageEvidence.tarball.sha512, `${label} tarball SHA-512`);
  assertEqual(
    `sha512-${createHash('sha512').update(tarball).digest('base64')}`,
    packageEvidence.tarball.integrity,
    `${label} tarball npm integrity`,
  );

  const packageManifestBytes = await readFile(artifactPath(packageEvidence.manifestReport.file));
  const packageManifest = JSON.parse(packageManifestBytes);
  assertEqual(
    sha512(packageManifestBytes),
    packageEvidence.manifestReport.sha512,
    `${label} package manifest SHA-512`,
  );
  assertEqual(packageManifest.name, packageEvidence.name, `${label} package manifest name`);
  assertEqual(packageManifest.version, packageEvidence.version, `${label} package manifest version`);
  assertEqual(packageManifest.filename, packageEvidence.tarball.file, `${label} package manifest filename`);
  assertEqual(packageManifest.integrity, packageEvidence.tarball.integrity, `${label} package manifest integrity`);
  assertEqual(packageManifest.shasum, packageEvidence.tarball.shasum, `${label} package manifest shasum`);

  const tarPackage = spawnSync('tar', [
    '-xOf',
    tarballPath,
    'package/package.json',
  ], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  if (tarPackage.error) {
    throw tarPackage.error;
  }
  if (tarPackage.status !== 0) {
    process.stderr.write(tarPackage.stderr);
    throw new Error(`tar exited with status ${tarPackage.status}.`);
  }
  if (JSON.stringify(JSON.parse(tarPackage.stdout)) !== JSON.stringify(packageEvidence.manifest)) {
    throw new Error(`${label} packed package.json does not match the evidence manifest.`);
  }
}

const bundleReportPath = artifactPath(evidence.reports.bundle.file);
const bundleReportBytes = await readFile(bundleReportPath);
JSON.parse(bundleReportBytes);
assertEqual(sha512(bundleReportBytes), evidence.reports.bundle.sha512, 'bundle report SHA-512');

const releaseProfileBytes = await readFile(resolve(root, 'config/release-profile.json'));
const promotionPolicyBytes = await readFile(resolve(root, 'config/release-promotion.json'));
const promotionPolicy = JSON.parse(promotionPolicyBytes.toString('utf8'));
const checkedOutCommit = run('git', ['rev-parse', 'HEAD']);
assertEqual(checkedOutCommit, evidence.source.commit, 'checked-out source commit');
assertEqual(
  run('git', ['rev-parse', `${checkedOutCommit}:config/release-profile.json`]),
  evidence.releaseProfile.revision,
  'release profile revision',
);
assertEqual(
  run('git', ['rev-parse', `${checkedOutCommit}:config/release-promotion.json`]),
  evidence.promotionPolicy.revision,
  'promotion policy revision',
);
assertEqual(sha512(releaseProfileBytes), evidence.releaseProfile.sha512, 'release profile SHA-512');
assertEqual(sha512(promotionPolicyBytes), evidence.promotionPolicy.sha512, 'promotion policy SHA-512');
assertEqual(process.versions.node, evidence.toolchain.node, 'Node version');
assertEqual(await getNpmVersion(), evidence.toolchain.npm, 'npm version');
assertEqual(
  promotionPolicy.publicationEnabled,
  evidence.promotionPolicy.publicationEnabled,
  'publication-enabled policy',
);
assertEqual(evidence.release.tag, `v${evidence.release.version}`, 'release tag');
assertEqual(
  evidence.release.npmTag,
  evidence.release.prerelease ? promotionPolicy.npm.prereleaseTag : promotionPolicy.npm.stableTag,
  'npm dist-tag',
);
for (const packageEvidence of evidence.packages) {
  assertEqual(packageEvidence.version, evidence.release.version, `${packageEvidence.name} release version`);
}

const expectedCommit = readArgument('--source-commit');
const expectedRepository = readArgument('--repository');
if (expectedCommit) {
  assertEqual(evidence.source.commit, expectedCommit, 'source commit');
}
if (expectedRepository) {
  assertEqual(evidence.source.repository, expectedRepository, 'source repository');
}

for (const packageEvidence of evidence.packages) {
  console.log(`Verified ${packageEvidence.tarball.file} at ${packageEvidence.tarball.sha512}.`);
}
