import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { readArguments } from './arguments.mjs';
import { publicationEnabled } from './publication.mjs';
import { validatePackageInventory } from './packages.mjs';
import { verifyCandidateValidation } from './validation.mjs';
import { publishDraftRelease } from './github-release.mjs';

const root = resolve(import.meta.dirname, '../..');
const args = readArguments({
  mode: { type: 'string', default: 'dry-run' },
  'artifact-dir': { type: 'string', default: 'release' },
});

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

const mode = args.mode;
if (!['dry-run', 'stage', 'publish'].includes(mode)) {
  throw new Error(`Unsupported GitHub release mode ${mode}.`);
}

const artifactDir = resolve(root, args['artifact-dir']);
const evidenceBytes = await readFile(resolve(artifactDir, 'release-evidence.json'));
const evidence = JSON.parse(evidenceBytes);
const policy = JSON.parse(await readFile(resolve(root, 'config/release-promotion.json'), 'utf8'));
if (evidence.schemaVersion !== 3 || !Array.isArray(evidence.packages)) {
  throw new Error(`Unsupported evidence schemaVersion ${evidence.schemaVersion}.`);
}
validatePackageInventory(evidence.packages);
const assetNames = [
  ...evidence.packages.flatMap(packageEvidence => [
    packageEvidence.tarball.file,
    packageEvidence.manifestReport.file,
  ]),
  'release-evidence.json',
  'release-evidence.sha512',
  evidence.reports.bundle.file,
  evidence.reports.developmentStarter.file,
  evidence.reports.developmentStarter.archive.file,
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

const evidenceChecksum = `${sha512(evidenceBytes)}  release-evidence.json`;
const expectedHashes = new Map([
  ...evidence.packages.flatMap(packageEvidence => [
    [packageEvidence.tarball.file, packageEvidence.tarball.sha512],
    [packageEvidence.manifestReport.file, packageEvidence.manifestReport.sha512],
  ]),
  ['release-evidence.json', sha512(evidenceBytes)],
  ['release-evidence.sha512', sha512(Buffer.from(`${evidenceChecksum}\n`))],
  [evidence.reports.bundle.file, evidence.reports.bundle.sha512],
  [evidence.reports.developmentStarter.file, evidence.reports.developmentStarter.sha512],
  [evidence.reports.developmentStarter.archive.file, evidence.reports.developmentStarter.archive.sha512],
]);

function verifyLocalAssets() {
  for (const [assetName, expectedHash] of expectedHashes) {
    const bytes = readFileSync(artifactPath(assetName));
    if (sha512(bytes) !== expectedHash) {
      throw new Error(`Local release asset differs from the verified evidence: ${assetName}`);
    }
  }
}

verifyLocalAssets();
const verification = spawnSync(process.execPath, [resolve(root, 'scripts/release/verify-artifact.mjs'),
  '--artifact-dir', artifactDir, '--require-validation'], { cwd: root, encoding: 'utf8' });
if (verification.error || verification.status !== 0) {
  throw new Error(`Release candidate is not verified: ${verification.error?.message || verification.stderr}`);
}
for (const asset of await verifyCandidateValidation(artifactDir, evidenceBytes)) {
  if (assetNames.includes(asset.file)) { throw new Error(`Duplicate release asset: ${asset.file}`); }
  assetNames.push(asset.file);
  assetPaths.push(artifactPath(asset.file));
  expectedHashes.set(asset.file, asset.sha512);
}

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
if (!publicationEnabled(policy, evidence.release.version)) {
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
  verifyLocalAssets();
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
      const remote = await readFile(resolve(downloadDir, assetName));
      if (sha512(remote) !== expectedHashes.get(assetName)) {
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

  const sourceUrl = `https://github.com/${evidence.source.repository}/blob/${evidence.source.commit}`;
  const notes = [
    `Install core: \`npm install marionette@${evidence.release.version}\`. Keep companion package versions aligned.`,
    '',
    `[Changes](${sourceUrl}/changelog.md) · [Migration guide](${sourceUrl}/upgradeGuide.md)`,
    ...(evidence.release.prerelease ? [
      `[Beta trial, starter and known limits](${sourceUrl}/docs/beta.md)`,
      'This is a prerelease for application trials, not a stable or comparative agent-readiness claim.',
    ] : []),
    '',
    `Immutable release artifact for ${evidence.source.commit}.`,
    '',
    ...evidence.packages.map(packageEvidence =>
      `${packageEvidence.name} tarball SHA-512: ${packageEvidence.tarball.sha512}`),
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
  verifyLocalAssets();
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
publishDraftRelease({ editArgs, ensureTag, run, verifyAssets: verifyLocalAssets });
console.log(`Published GitHub release ${evidence.release.tag}.`);
