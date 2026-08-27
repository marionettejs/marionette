import { readFile, appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';

const root = resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const policy = await readJson('config/release-promotion.json');
const packageJson = await readJson('package.json');

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
  if (policy.workflow !== policy.npm?.trustedPublisher?.workflow) {
    fail('workflow and npm trusted-publisher workflow do not agree');
  }
  if (policy.environment !== policy.npm?.trustedPublisher?.environment) {
    fail('environment and npm trusted-publisher environment do not agree');
  }
  if (!Number.isInteger(policy.artifactRetentionDays) ||
      policy.artifactRetentionDays < 1 || policy.artifactRetentionDays > 90) {
    fail('artifactRetentionDays must be between 1 and 90');
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
