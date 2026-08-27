import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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

function run(commandArgs, options = {}) {
  const result = spawnSync('gh', commandArgs, {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      GH_TOKEN: process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '',
    },
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0 && !options.allowFailure) {
    process.stderr.write(result.stderr);
    throw new Error(`gh exited with status ${result.status}.`);
  }

  return result;
}

function sha512(buffer) {
  return createHash('sha512').update(buffer).digest('hex');
}

const mode = readArgument('--mode', 'dry-run');
if (!['dry-run', 'stage', 'publish'].includes(mode)) {
  throw new Error(`Unsupported GitHub release mode ${mode}.`);
}

const artifactDir = resolve(root, readArgument('--artifact-dir', 'release'));
const evidenceBytes = await readFile(resolve(artifactDir, 'release-evidence.json'));
const evidence = JSON.parse(evidenceBytes);
const policy = JSON.parse(await readFile(resolve(root, 'config/release-promotion.json'), 'utf8'));
const assetNames = [
  evidence.package.tarball.file,
  'release-evidence.json',
  'release-evidence.sha512',
  evidence.reports.packageManifest.file,
  evidence.reports.bundle.file,
];

function artifactPath(fileName) {
  if (typeof fileName !== 'string' || !fileName || fileName === '.' || fileName === '..' ||
      fileName.includes('/') || fileName.includes('\\') || fileName.includes(':')) {
    throw new Error(`Release artifact must use a contained file name: ${fileName}`);
  }
  return resolve(artifactDir, fileName);
}

const assetPaths = assetNames.map(artifactPath);
if (new Set(assetNames).size !== assetNames.length) {
  throw new Error('Release artifact contains duplicate asset names.');
}

async function verifyLocalAssets() {
  const checksum = (await readFile(artifactPath('release-evidence.sha512'), 'utf8')).trim();
  if (checksum !== `${sha512(evidenceBytes)}  release-evidence.json`) {
    throw new Error('Release evidence checksum does not match.');
  }
  const expectedHashes = new Map([
    [evidence.package.tarball.file, evidence.package.tarball.sha512],
    [evidence.reports.packageManifest.file, evidence.reports.packageManifest.sha512],
    [evidence.reports.bundle.file, evidence.reports.bundle.sha512],
  ]);
  for (const [assetName, expectedHash] of expectedHashes) {
    const bytes = await readFile(artifactPath(assetName));
    if (sha512(bytes) !== expectedHash) {
      throw new Error(`Local release asset differs from the verified evidence: ${assetName}`);
    }
  }
}

await verifyLocalAssets();

if (mode === 'dry-run') {
  console.log(JSON.stringify({
    repository: evidence.source.repository,
    tag: evidence.release.tag,
    target: evidence.source.commit,
    prerelease: evidence.release.prerelease,
    assets: assetNames,
  }, null, 2));
  process.exit(0);
}
if (!policy.publicationEnabled || !evidence.promotionPolicy.publicationEnabled) {
  throw new Error('GitHub release publication is disabled by the checked-in policy.');
}

const viewArgs = [
  'release',
  'view',
  evidence.release.tag,
  '--repo',
  evidence.source.repository,
  '--json',
  'assets,isDraft,tagName,targetCommitish',
];

async function verifyRelease(release) {
  if (release.targetCommitish !== evidence.source.commit) {
    throw new Error('Release targets a different source commit.');
  }
  const existingAssets = release.assets.map(asset => asset.name).sort();
  const expectedAssets = [...assetNames].sort();
  if (JSON.stringify(existingAssets) !== JSON.stringify(expectedAssets)) {
    throw new Error('Release has a different asset manifest.');
  }

  const downloadDir = await mkdtemp(join(tmpdir(), 'marionette-release-assets-'));
  try {
    run([
      'release',
      'download',
      evidence.release.tag,
      '--repo',
      evidence.source.repository,
      '--dir',
      downloadDir,
    ]);
    const downloadedAssets = await readdir(downloadDir);
    if (JSON.stringify(downloadedAssets.sort()) !== JSON.stringify(expectedAssets)) {
      throw new Error('Downloaded release assets do not match the expected manifest.');
    }
    for (const assetName of assetNames) {
      const local = await readFile(artifactPath(assetName));
      const remote = await readFile(resolve(downloadDir, assetName));
      if (sha512(local) !== sha512(remote)) {
        throw new Error(`Release asset differs from the verified artifact: ${assetName}`);
      }
    }
  } finally {
    await rm(downloadDir, { force: true, recursive: true });
  }
}

function ensureTag() {
  const repositoryPath = `repos/${evidence.source.repository}`;
  const tagPath = encodeURIComponent(evidence.release.tag);
  const ref = run([
    'api',
    `${repositoryPath}/git/ref/tags/${tagPath}`,
    '--jq',
    '[.object.type, .object.sha] | @tsv',
  ], { allowFailure: true });
  if (ref.status !== 0) {
    if (!/HTTP 404|Not Found/.test(ref.stderr)) {
      process.stderr.write(ref.stderr);
      throw new Error(`Unable to inspect tag ${evidence.release.tag}.`);
    }
    run([
      'api',
      '--method',
      'POST',
      `${repositoryPath}/git/refs`,
      '-f',
      `ref=refs/tags/${evidence.release.tag}`,
      '-f',
      `sha=${evidence.source.commit}`,
    ]);
    console.log(`Created missing tag ${evidence.release.tag} at ${evidence.source.commit}.`);
    return;
  }

  let [objectType, objectSha] = ref.stdout.trim().split('\t');
  const visited = new Set();
  while (objectType === 'tag') {
    if (visited.has(objectSha)) {
      throw new Error(`Tag ${evidence.release.tag} contains a cycle.`);
    }
    visited.add(objectSha);
    const tag = run([
      'api',
      `${repositoryPath}/git/tags/${objectSha}`,
      '--jq',
      '[.object.type, .object.sha] | @tsv',
    ]);
    [objectType, objectSha] = tag.stdout.trim().split('\t');
  }
  if (objectType !== 'commit' || objectSha !== evidence.source.commit) {
    throw new Error(`Tag ${evidence.release.tag} does not resolve to the verified source commit.`);
  }
}

if (mode === 'stage') {
  const existing = run(viewArgs, { allowFailure: true });
  if (existing.status === 0) {
    const release = JSON.parse(existing.stdout);
    await verifyRelease(release);
    console.log(`Release ${evidence.release.tag} already contains the verified assets.`);
    process.exit(0);
  }
  if (!/release not found|HTTP 404|Not Found/i.test(existing.stderr)) {
    process.stderr.write(existing.stderr);
    throw new Error(`Unable to inspect release ${evidence.release.tag}.`);
  }

  const notes = [
    `Immutable release artifact for ${evidence.source.commit}.`,
    '',
    `Tarball SHA-512: ${evidence.package.tarball.sha512}`,
  ].join('\n');
  const createArgs = [
    'release',
    'create',
    evidence.release.tag,
    '--repo',
    evidence.source.repository,
    '--target',
    evidence.source.commit,
    '--title',
    evidence.release.tag,
    '--notes',
    notes,
    '--draft',
  ];
  if (evidence.release.prerelease) {
    createArgs.push('--prerelease');
  }
  createArgs.push(...assetPaths);
  run(createArgs);
  console.log(`Staged draft release ${evidence.release.tag}.`);
  process.exit(0);
}

const existing = run(viewArgs);
const release = JSON.parse(existing.stdout);
await verifyRelease(release);
if (!release.isDraft) {
  ensureTag();
  console.log(`Release ${evidence.release.tag} is already public with the verified assets.`);
  process.exit(0);
}

const editArgs = [
  'release',
  'edit',
  evidence.release.tag,
  '--repo',
  evidence.source.repository,
  '--draft=false',
];
if (evidence.release.prerelease) {
  editArgs.push('--prerelease');
} else {
  editArgs.push('--latest');
}
ensureTag();
run(editArgs);
console.log(`Published GitHub release ${evidence.release.tag}.`);
