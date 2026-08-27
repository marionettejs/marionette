import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
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

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    throw new Error(`${command} exited with status ${result.status}`);
  }

  return result.stdout.trim();
}

function sha512(buffer) {
  return createHash('sha512').update(buffer).digest('hex');
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function readJson(file) {
  return JSON.parse(await readFile(resolve(root, file), 'utf8'));
}

async function getNpmVersion() {
  const npmExecPath = process.env.npm_execpath;
  if (!npmExecPath) {
    throw new Error('Run release:artifact through npm so the npm CLI can be located.');
  }

  const npmPackagePath = resolve(dirname(npmExecPath), '..', 'package.json');
  const npmPackage = JSON.parse(await readFile(npmPackagePath, 'utf8'));
  return npmPackage.version;
}

const outputDir = resolve(root, readArgument('--output', 'release'));
await mkdir(outputDir, { recursive: true });
if ((await readdir(outputDir)).length !== 0) {
  throw new Error(`Release artifact directory must be empty: ${outputDir}`);
}
const repositoryStatus = run('git', ['status', '--short', '--untracked-files=all']);
if (repositoryStatus) {
  process.stderr.write(`${repositoryStatus}\n`);
  throw new Error('Release artifacts must be built from a clean checkout.');
}

const sourceCommit = readArgument('--source-commit', process.env.GITHUB_SHA);
const sourceRef = readArgument('--source-ref', process.env.GITHUB_REF || 'local');
const repository = readArgument('--repository', process.env.GITHUB_REPOSITORY || 'marionettejs/marionette');
if (!sourceCommit || !/^[a-f0-9]{40}$/.test(sourceCommit)) {
  throw new Error('A full 40-character source commit is required.');
}

const packageJson = await readJson('package.json');
const releaseProfile = await readJson('config/release-profile.json');
const promotionPolicy = await readJson('config/release-promotion.json');
if (repository !== promotionPolicy.repository) {
  throw new Error(`Repository ${repository} does not match ${promotionPolicy.repository}.`);
}

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  throw new Error('Run release:artifact through npm so the npm CLI can be located.');
}

const packOutput = run(process.execPath, [
  npmCli,
  'pack',
  '--ignore-scripts',
  '--json',
  '--pack-destination',
  outputDir,
]);
const packResults = JSON.parse(packOutput);
if (packResults.length !== 1) {
  throw new Error(`Expected one packed tarball, received ${packResults.length}.`);
}

const packageManifest = packResults[0];
const tarballPath = resolve(outputDir, packageManifest.filename);
const tarball = await readFile(tarballPath);
const tarballSha512 = sha512(tarball);
const tarballIntegrity = `sha512-${createHash('sha512').update(tarball).digest('base64')}`;
if (packageManifest.integrity !== tarballIntegrity) {
  throw new Error('npm pack integrity does not match the generated tarball.');
}

const packageManifestText = `${JSON.stringify(packageManifest, null, 2)}\n`;
await writeFile(resolve(outputDir, 'package-manifest.json'), packageManifestText);

const bundleReportText = `${run(process.execPath, [
  resolve(root, 'config/bundle-size.mjs'),
  '--json',
])}\n`;
await writeFile(resolve(outputDir, 'bundle-report.json'), bundleReportText);

const releaseProfileBytes = await readFile(resolve(root, 'config/release-profile.json'));
const promotionPolicyBytes = await readFile(resolve(root, 'config/release-promotion.json'));
const prerelease = packageJson.version.includes('-');
const npmTag = prerelease ? promotionPolicy.npm.prereleaseTag : promotionPolicy.npm.stableTag;
const evidence = {
  schemaVersion: 1,
  package: {
    name: packageJson.name,
    version: packageJson.version,
    manifest: packageJson,
    tarball: {
      file: packageManifest.filename,
      size: tarball.length,
      sha256: sha256(tarball),
      sha512: tarballSha512,
      integrity: tarballIntegrity,
      shasum: packageManifest.shasum,
    },
    npmTag,
  },
  release: {
    tag: `v${packageJson.version}`,
    prerelease,
  },
  source: {
    repository,
    commit: sourceCommit,
    ref: sourceRef,
  },
  toolchain: {
    node: process.versions.node,
    npm: await getNpmVersion(),
  },
  releaseProfile: {
    revision: run('git', ['hash-object', 'config/release-profile.json']),
    sha512: sha512(releaseProfileBytes),
    profile: releaseProfile,
  },
  promotionPolicy: {
    revision: run('git', ['hash-object', 'config/release-promotion.json']),
    sha512: sha512(promotionPolicyBytes),
    publicationEnabled: promotionPolicy.publicationEnabled,
  },
  reports: {
    packageManifest: {
      file: 'package-manifest.json',
      sha512: sha512(Buffer.from(packageManifestText)),
    },
    bundle: {
      file: 'bundle-report.json',
      sha512: sha512(Buffer.from(bundleReportText)),
    },
  },
  workflow: {
    runId: process.env.GITHUB_RUN_ID || null,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
    runnerImage: process.env.ImageOS || null,
    runnerImageVersion: process.env.ImageVersion || null,
  },
};

const evidenceText = `${JSON.stringify(evidence, null, 2)}\n`;
await writeFile(resolve(outputDir, 'release-evidence.json'), evidenceText);
await writeFile(
  resolve(outputDir, 'release-evidence.sha512'),
  `${sha512(Buffer.from(evidenceText))}  release-evidence.json\n`,
);

if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `tarball=${packageManifest.filename}\n`);
  await appendFile(process.env.GITHUB_OUTPUT, `version=${packageJson.version}\n`);
  await appendFile(process.env.GITHUB_OUTPUT, `tag=v${packageJson.version}\n`);
  await appendFile(process.env.GITHUB_OUTPUT, `npm_tag=${npmTag}\n`);
  await appendFile(process.env.GITHUB_OUTPUT, `prerelease=${prerelease}\n`);
}

console.log(`Created ${packageManifest.filename} from ${sourceCommit}.`);
console.log(`SHA-512: ${tarballSha512}`);
