import { readFile, appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';

const root = resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const policy = await readJson('config/release-promotion.json');
const packageJson = await readJson('package.json');

function parseArguments() {
  const allowed = new Set(['--mode', '--repository', '--ref', '--event']);
  const parsed = new Map();

  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!allowed.has(name)) {
      fail(`unsupported argument ${name}`);
    }
    if (!value || value.startsWith('--')) {
      fail(`missing value for ${name}`);
    }
    if (parsed.has(name)) {
      fail(`duplicate argument ${name}`);
    }
    parsed.set(name, value);
  }

  return parsed;
}

function readArgument(name, fallback) {
  return parsedArgs.get(name) ?? fallback;
}

async function readJson(file) {
  return JSON.parse(await readFile(resolve(root, file), 'utf8'));
}

function fail(message) {
  throw new Error(`Release promotion preflight failed: ${message}`);
}

function validatePolicy() {
  if (policy.schemaVersion !== 1) {
    fail(`unsupported schemaVersion ${policy.schemaVersion}`);
  }
  if (typeof policy.publicationEnabled !== 'boolean') {
    fail('publicationEnabled must be a boolean');
  }
  if (policy.repository !== 'marionettejs/marionette') {
    fail(`unexpected repository ${policy.repository}`);
  }
  if (policy.defaultBranch !== 'master') {
    fail(`unexpected default branch ${policy.defaultBranch}`);
  }
  if (policy.workflow !== 'release.yml' || policy.npm?.trustedPublisher?.workflow !== 'release.yml') {
    fail('workflow and npm trusted-publisher workflow must be release.yml');
  }
  if (policy.environment !== 'stable-release' ||
      policy.npm?.trustedPublisher?.environment !== 'stable-release') {
    fail('environment and npm trusted-publisher environment must be stable-release');
  }
  if (policy.artifactRetentionDays !== 90) {
    fail('artifactRetentionDays must match the workflow retention of 90');
  }
  if (policy.npm?.registry !== 'https://registry.npmjs.org/' || policy.npm?.access !== 'public') {
    fail('npm registry and access must match the public npm publication contract');
  }
  if (policy.npm?.stableTag !== 'latest' || policy.npm?.prereleaseTag !== 'next') {
    fail('npm dist-tags must be latest for stable and next for prerelease');
  }
  if (policy.npm?.trustedPublisher?.provider !== 'github-actions') {
    fail('npm trusted-publisher provider must be github-actions');
  }
  if (packageJson.repository?.url !== `https://github.com/${policy.repository}.git`) {
    fail('package repository URL does not match the trusted-publisher repository');
  }
}

async function writeOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  }
}

const parsedArgs = parseArguments();
validatePolicy();

const mode = readArgument('--mode', 'dry-run');
const repository = readArgument('--repository', policy.repository);
const ref = readArgument('--ref', `refs/heads/${policy.defaultBranch}`);
const event = readArgument('--event', 'local');

if (!['dry-run', 'publish'].includes(mode)) {
  fail(`unsupported mode ${mode}`);
}
if (repository !== policy.repository) {
  fail(`workflow repository ${repository} does not match ${policy.repository}`);
}
if (mode === 'publish') {
  if (!policy.publicationEnabled) {
    fail('publication is disabled until the final stable-release authorization');
  }
  if (event !== 'workflow_dispatch') {
    fail('publication is allowed only from workflow_dispatch');
  }
  if (ref !== `refs/heads/${policy.defaultBranch}`) {
    fail(`publication requires refs/heads/${policy.defaultBranch}; received ${ref}`);
  }
}

await writeOutput('mode', mode);
await writeOutput('publication_enabled', String(policy.publicationEnabled));

console.log(`Release promotion preflight passed in ${mode} mode; publication enabled: ${policy.publicationEnabled}.`);
