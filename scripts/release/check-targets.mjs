import { spawnSync } from 'node:child_process';
import { appendFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
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

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: 'utf8',
    env: options.env || process.env,
    maxBuffer: 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }

  return result;
}

async function writeOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  }
}

const mode = readArgument('--mode', 'dry-run');
if (!['dry-run', 'publish', 'npm-decision', 'verify-npm'].includes(mode)) {
  throw new Error(`Unsupported target-check mode ${mode}.`);
}

const artifactDir = resolve(root, readArgument('--artifact-dir', 'release'));
const evidence = JSON.parse(await readFile(resolve(artifactDir, 'release-evidence.json'), 'utf8'));
if (evidence.schemaVersion !== 2 || !Array.isArray(evidence.packages)) {
  throw new Error(`Unsupported evidence schemaVersion ${evidence.schemaVersion}.`);
}
const packageIds = evidence.packages.map(packageEvidence => packageEvidence.id);
if (JSON.stringify(packageIds) !== JSON.stringify(['core', 'data'])) {
  throw new Error(`Unexpected release package order: ${packageIds.join(', ')}.`);
}
const packageNames = new Map([
  ['core', 'marionette'],
  ['data', '@marionette/data'],
]);
for (const packageEvidence of evidence.packages) {
  if (packageEvidence.name !== packageNames.get(packageEvidence.id)) {
    throw new Error(`Unexpected ${packageEvidence.id} package name: ${packageEvidence.name}.`);
  }
}
const npmExecPath = process.env.npm_execpath;
if (!npmExecPath) {
  throw new Error('Run release:targets through npm so the npm CLI can be located.');
}

const npmAttempts = mode === 'verify-npm' ? 12 : 1;
const npmStates = [];
for (const packageEvidence of evidence.packages) {
  const packageName = packageNames.get(packageEvidence.id);
  let state;
  let npmError;
  for (let attempt = 1; attempt <= npmAttempts; attempt += 1) {
    const npmResult = run(process.execPath, [
      npmExecPath,
      'view',
      `${packageName}@${packageEvidence.version}`,
      'dist.integrity',
      '--json',
    ]);
    npmError = undefined;
    if (npmResult.status === 0) {
      const publishedIntegrity = JSON.parse(npmResult.stdout);
      state = publishedIntegrity === packageEvidence.tarball.integrity ? 'exact' : 'conflict';
    } else if (/E404|404 Not Found/.test(npmResult.stderr)) {
      state = 'available';
    } else {
      state = 'unavailable';
      npmError = npmResult;
    }

    if (state === 'exact' || state === 'conflict' || attempt === npmAttempts) {
      break;
    }
    console.warn(`${packageName} npm integrity is ${state}; retrying in 5 seconds (${attempt}/${npmAttempts}).`);
    await new Promise(resolveDelay => setTimeout(resolveDelay, 5000));
  }
  if (npmError) {
    process.stderr.write(npmError.stderr);
    throw new Error(`${packageName} npm view exited with status ${npmError.status} after ${npmAttempts} attempts.`);
  }
  npmStates.push({ packageEvidence, packageName, state });
}

const repositoryUrl = `https://github.com/${evidence.source.repository}.git`;
const tagResult = run('git', [
  'ls-remote',
  '--tags',
  repositoryUrl,
  `refs/tags/${evidence.release.tag}`,
  `refs/tags/${evidence.release.tag}^{}`,
]);
if (tagResult.status !== 0) {
  process.stderr.write(tagResult.stderr);
  throw new Error(`git ls-remote exited with status ${tagResult.status}.`);
}
const tagLines = tagResult.stdout.trim().split('\n').filter(Boolean);
let tagState = 'available';
if (tagLines.length) {
  const peeledTag = tagLines.find(line => line.endsWith('^{}'));
  const tagCommit = (peeledTag || tagLines[0]).split(/\s+/)[0];
  tagState = tagCommit === evidence.source.commit ? 'exact' : 'conflict';
}

const releaseResult = run('gh', [
  'api',
  `repos/${evidence.source.repository}/releases/tags/${evidence.release.tag}`,
  '--jq',
  '.id',
], {
  env: {
    ...process.env,
    GH_TOKEN: process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '',
  },
});
let releaseState;
if (releaseResult.status === 0) {
  releaseState = 'exists';
} else if (/HTTP 404|Not Found/.test(releaseResult.stderr)) {
  releaseState = 'available';
} else {
  process.stderr.write(releaseResult.stderr);
  throw new Error(`gh api exited with status ${releaseResult.status}.`);
}

await writeOutput('tag_state', tagState);
await writeOutput('release_state', releaseState);
for (const { packageEvidence, packageName, state } of npmStates) {
  await writeOutput(`${packageEvidence.id}_npm_state`, state);
  if (mode === 'npm-decision') {
    if (state === 'conflict') {
      throw new Error(`${packageName} exists with different integrity.`);
    }
    await writeOutput(`${packageEvidence.id}_npm_action`, state === 'available' ? 'publish' : 'skip');
  }
}

console.log(JSON.stringify({
  packages: npmStates.map(({ packageEvidence, packageName, state }) => ({
    package: `${packageName}@${packageEvidence.version}`,
    npm: state,
  })),
  tag: tagState,
  release: releaseState,
}, null, 2));

if (mode === 'publish') {
  const unavailable = [
    ...npmStates.map(({ packageName, state }) =>
      [`${packageName} npm version`, state, ['available', 'exact']]),
    ['Git tag', tagState, ['available', 'exact']],
    ['GitHub release', releaseState, ['available', 'exists']],
  ].filter(([, state, allowed]) => !allowed.includes(state));

  if (unavailable.length) {
    const summary = unavailable.map(([target, state]) => `${target}: ${state}`).join(', ');
    throw new Error(`Publication targets conflict with the verified artifact (${summary}).`);
  }
}
if (mode === 'verify-npm') {
  const incomplete = npmStates.filter(({ state }) => state !== 'exact');
  if (incomplete.length) {
    throw new Error(`Published npm integrity is not exact for ${incomplete
      .map(({ packageName }) => packageName).join(', ')}.`);
  }
}
