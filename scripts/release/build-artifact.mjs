import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
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
const outputRelativePath = relative(root, outputDir);
const outputIsInsideRepository = outputRelativePath && !isAbsolute(outputRelativePath) &&
  outputRelativePath !== '..' && !outputRelativePath.startsWith(`..${sep}`);
const statusArguments = ['status', '--short', '--untracked-files=all'];
if (outputIsInsideRepository) {
  const outputPathspec = outputRelativePath.split(sep).join('/');
  statusArguments.push('--', '.', `:(top,literal,exclude)${outputPathspec}`);
}
const repositoryStatus = run('git', statusArguments);
if (repositoryStatus) {
  process.stderr.write(`${repositoryStatus}\n`);
  throw new Error('Release artifacts must be built from a clean checkout.');
}

const requestedSourceCommit = readArgument('--source-commit', process.env.GITHUB_SHA);
const sourceRef = readArgument('--source-ref', process.env.GITHUB_REF || 'local');
const repository = readArgument('--repository', process.env.GITHUB_REPOSITORY || 'marionettejs/marionette');
if (requestedSourceCommit && !/^[a-f0-9]{40}$/.test(requestedSourceCommit)) {
  throw new Error('A full 40-character source commit is required.');
}
const sourceCommit = run('git', ['rev-parse', 'HEAD']);
if (requestedSourceCommit && requestedSourceCommit !== sourceCommit) {
  throw new Error(`Source commit ${requestedSourceCommit} does not match checked-out commit ${sourceCommit}.`);
}

const packageConfigurations = [
  { id: 'core', name: 'marionette', directory: '.', manifestFile: 'core-package-manifest.json' },
  { id: 'data', name: '@marionette/data', directory: 'packages/data', manifestFile: 'data-package-manifest.json' },
  { id: 'adapters', name: '@marionette/adapters', directory: 'packages/adapters', manifestFile: 'adapters-package-manifest.json' },
];
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

// Ignored outputs must be rebuilt from this source before packing.
run(process.execPath, [npmCli, 'run', 'build']);
run(process.execPath, [npmCli, 'run', 'test:dist']);

const packages = [];
for (const configuration of packageConfigurations) {
  const manifest = await readJson(`${configuration.directory}/package.json`);
  if (manifest.name !== configuration.name) {
    throw new Error(`Unexpected ${configuration.id} package name: ${manifest.name}.`);
  }
  if (manifest.version !== packageJson.version) {
    throw new Error(`${manifest.name} version ${manifest.version} does not match ${packageJson.version}.`);
  }
  if (configuration.id === 'adapters' && manifest.peerDependencies?.marionette !== packageJson.version) {
    throw new Error(`${manifest.name} Marionette peer ${manifest.peerDependencies?.marionette || 'missing'} does not match ${packageJson.version}.`);
  }

  const packOutput = run(process.execPath, [
    npmCli,
    'pack',
    resolve(root, configuration.directory),
    '--ignore-scripts',
    '--json',
    '--pack-destination',
    outputDir,
  ]);
  const packResults = JSON.parse(packOutput);
  if (packResults.length !== 1) {
    throw new Error(`Expected one ${configuration.id} tarball, received ${packResults.length}.`);
  }

  const packageManifest = packResults[0];
  if (packageManifest.name !== configuration.name) {
    throw new Error(`Unexpected packed ${configuration.id} package name: ${packageManifest.name}.`);
  }
  const tarball = await readFile(resolve(outputDir, packageManifest.filename));
  const tarballSha512 = sha512(tarball);
  const tarballIntegrity = `sha512-${createHash('sha512').update(tarball).digest('base64')}`;
  if (packageManifest.integrity !== tarballIntegrity) {
    throw new Error(`${manifest.name} npm pack integrity does not match the generated tarball.`);
  }

  const packageManifestText = `${JSON.stringify(packageManifest, null, 2)}\n`;
  await writeFile(resolve(outputDir, configuration.manifestFile), packageManifestText);
  packages.push({
    id: configuration.id,
    name: configuration.name,
    version: manifest.version,
    manifest,
    manifestReport: {
      file: configuration.manifestFile,
      sha512: sha512(Buffer.from(packageManifestText)),
    },
    tarball: {
      file: packageManifest.filename,
      size: tarball.length,
      sha256: sha256(tarball),
      sha512: tarballSha512,
      integrity: tarballIntegrity,
      shasum: packageManifest.shasum,
    },
  });
}

const bundleReportText = `${run(process.execPath, [
  resolve(root, 'scripts/performance/bundle-size.mjs'),
  '--json',
])}\n`;
await writeFile(resolve(outputDir, 'bundle-report.json'), bundleReportText);

const releaseProfileBytes = await readFile(resolve(root, 'config/release-profile.json'));
const promotionPolicyBytes = await readFile(resolve(root, 'config/release-promotion.json'));
const finalCommit = run('git', ['rev-parse', 'HEAD']);
if (finalCommit !== sourceCommit) {
  throw new Error(`Checked-out commit changed during artifact construction: ${sourceCommit} to ${finalCommit}.`);
}
const finalRepositoryStatus = run('git', statusArguments);
if (finalRepositoryStatus) {
  process.stderr.write(`${finalRepositoryStatus}\n`);
  throw new Error('Checkout changed during artifact construction.');
}
const prerelease = packageJson.version.includes('-');
const npmTag = prerelease ? promotionPolicy.npm.prereleaseTag : promotionPolicy.npm.stableTag;
const evidence = {
  schemaVersion: 2,
  packages,
  release: {
    tag: `v${packageJson.version}`,
    prerelease,
    npmTag,
    version: packageJson.version,
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
    revision: run('git', ['rev-parse', `${sourceCommit}:config/release-profile.json`]),
    sha512: sha512(releaseProfileBytes),
    profile: releaseProfile,
  },
  promotionPolicy: {
    revision: run('git', ['rev-parse', `${sourceCommit}:config/release-promotion.json`]),
    sha512: sha512(promotionPolicyBytes),
    publicationEnabled: promotionPolicy.publicationEnabled,
  },
  reports: {
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
  for (const packageEvidence of packages) {
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `${packageEvidence.id}_tarball=${packageEvidence.tarball.file}\n`,
    );
  }
  await appendFile(process.env.GITHUB_OUTPUT, `version=${packageJson.version}\n`);
  await appendFile(process.env.GITHUB_OUTPUT, `tag=v${packageJson.version}\n`);
  await appendFile(process.env.GITHUB_OUTPUT, `npm_tag=${npmTag}\n`);
  await appendFile(process.env.GITHUB_OUTPUT, `prerelease=${prerelease}\n`);
}

for (const packageEvidence of packages) {
  console.log(`Created ${packageEvidence.tarball.file} from ${sourceCommit}.`);
  console.log(`SHA-512: ${packageEvidence.tarball.sha512}`);
}
