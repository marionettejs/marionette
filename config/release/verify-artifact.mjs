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
if (evidence.schemaVersion !== 1) {
  throw new Error(`Unsupported evidence schemaVersion ${evidence.schemaVersion}.`);
}

const checksum = (await readFile(resolve(artifactDir, 'release-evidence.sha512'), 'utf8')).trim();
assertEqual(checksum, `${sha512(evidenceBytes)}  release-evidence.json`, 'evidence checksum');

const tarballPath = resolve(artifactDir, evidence.package.tarball.file);
const tarball = await readFile(tarballPath);
assertEqual(tarball.length, evidence.package.tarball.size, 'tarball size');
assertEqual(sha256(tarball), evidence.package.tarball.sha256, 'tarball SHA-256');
assertEqual(sha512(tarball), evidence.package.tarball.sha512, 'tarball SHA-512');
assertEqual(
  `sha512-${createHash('sha512').update(tarball).digest('base64')}`,
  evidence.package.tarball.integrity,
  'tarball npm integrity',
);

const packageManifestPath = resolve(artifactDir, evidence.reports.packageManifest.file);
const packageManifestBytes = await readFile(packageManifestPath);
const packageManifest = JSON.parse(packageManifestBytes);
assertEqual(sha512(packageManifestBytes), evidence.reports.packageManifest.sha512, 'package manifest SHA-512');
assertEqual(packageManifest.name, evidence.package.name, 'package manifest name');
assertEqual(packageManifest.version, evidence.package.version, 'package manifest version');
assertEqual(packageManifest.filename, evidence.package.tarball.file, 'package manifest filename');
assertEqual(packageManifest.integrity, evidence.package.tarball.integrity, 'package manifest integrity');
assertEqual(packageManifest.shasum, evidence.package.tarball.shasum, 'package manifest shasum');

const bundleReportPath = resolve(artifactDir, evidence.reports.bundle.file);
const bundleReportBytes = await readFile(bundleReportPath);
JSON.parse(bundleReportBytes);
assertEqual(sha512(bundleReportBytes), evidence.reports.bundle.sha512, 'bundle report SHA-512');

const releaseProfileBytes = await readFile(resolve(root, 'config/release-profile.json'));
const promotionPolicyBytes = await readFile(resolve(root, 'config/release-promotion.json'));
const promotionPolicy = JSON.parse(promotionPolicyBytes.toString('utf8'));
assertEqual(sha512(releaseProfileBytes), evidence.releaseProfile.sha512, 'release profile SHA-512');
assertEqual(sha512(promotionPolicyBytes), evidence.promotionPolicy.sha512, 'promotion policy SHA-512');
assertEqual(process.versions.node, evidence.toolchain.node, 'Node version');
assertEqual(await getNpmVersion(), evidence.toolchain.npm, 'npm version');
assertEqual(
  promotionPolicy.publicationEnabled,
  evidence.promotionPolicy.publicationEnabled,
  'publication-enabled policy',
);
assertEqual(evidence.release.tag, `v${evidence.package.version}`, 'release tag');
assertEqual(
  evidence.package.npmTag,
  evidence.release.prerelease ? promotionPolicy.npm.prereleaseTag : promotionPolicy.npm.stableTag,
  'npm dist-tag',
);

const expectedCommit = readArgument('--source-commit');
const expectedRepository = readArgument('--repository');
if (expectedCommit) {
  assertEqual(evidence.source.commit, expectedCommit, 'source commit');
}
if (expectedRepository) {
  assertEqual(evidence.source.repository, expectedRepository, 'source repository');
}

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
if (JSON.stringify(JSON.parse(tarPackage.stdout)) !== JSON.stringify(evidence.package.manifest)) {
  throw new Error('Packed package.json does not match the evidence manifest.');
}

console.log(`Verified ${evidence.package.tarball.file} at ${evidence.package.tarball.sha512}.`);
