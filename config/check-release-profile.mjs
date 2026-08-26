import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';

const root = resolve(import.meta.dirname, '..');
const profile = await readJson('config/release-profile.json');
const packageJson = await readJson('package.json');
const packageLock = await readJson('package-lock.json');
const nvmVersion = (await readFile(resolve(root, '.nvmrc'), 'utf8')).trim();
const ciWorkflow = await readFile(resolve(root, '.github/workflows/ci.yml'), 'utf8');
const args = process.argv.slice(2);

function fail(message) {
  console.error(`Release profile mismatch: ${message}`);
  process.exitCode = 1;
}

async function readJson(file) {
  return JSON.parse(await readFile(resolve(root, file), 'utf8'));
}

function readArgument(name) {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${name}`);
  }

  return value;
}

async function getNpmVersion() {
  const npmExecPath = process.env.npm_execpath;
  if (!npmExecPath) {
    throw new Error('Run this check through npm so the npm version can be verified.');
  }

  const npmPackage = JSON.parse(await readFile(resolve(npmExecPath, '../..', 'package.json'), 'utf8'));
  return npmPackage.version;
}

async function validateSource() {
  const nodeVersion = process.versions.node;
  const npmVersion = await getNpmVersion();

  if (profile.schemaVersion !== 1) {
    fail(`unsupported schemaVersion ${profile.schemaVersion}`);
  }
  if (nodeVersion !== profile.source.node) {
    fail(`Node ${nodeVersion} is running; expected ${profile.source.node}`);
  }
  if (npmVersion !== profile.source.npm) {
    fail(`npm ${npmVersion} is running; expected ${profile.source.npm}`);
  }
  if (nvmVersion !== profile.source.node) {
    fail(`.nvmrc contains ${nvmVersion}; expected ${profile.source.node}`);
  }
  if (packageJson.packageManager !== `npm@${profile.source.npm}`) {
    fail(`packageManager is ${packageJson.packageManager}; expected npm@${profile.source.npm}`);
  }
  if (packageJson.engines?.node !== profile.source.consumerNodeRange) {
    fail(`engines.node is ${packageJson.engines?.node}; expected ${profile.source.consumerNodeRange}`);
  }
  if (packageLock.lockfileVersion !== profile.source.lockfileVersion) {
    fail(`lockfileVersion is ${packageLock.lockfileVersion}; expected ${profile.source.lockfileVersion}`);
  }
}

function validateWorkflow() {
  if (/runs-on:\s+\S*-latest/.test(ciWorkflow)) {
    fail('CI uses a moving *-latest runner label');
  }
  if (/^\s+node-version:\s/m.test(ciWorkflow)) {
    fail('CI bypasses the exact Node version in .nvmrc');
  }

  for (const host of profile.hosts) {
    const runnerPattern = new RegExp(`(?:runs-on|runner):\\s+${host.runner.replace('.', '\\.')}\\s*$`, 'm');
    if (!runnerPattern.test(ciWorkflow)) {
      fail(`CI does not declare runner ${host.runner} for host ${host.id}`);
    }
  }
}

function validateHost() {
  const hostId = readArgument('--host');
  const runner = readArgument('--runner');

  if (!hostId && !runner) {
    return;
  }
  if (!hostId || !runner) {
    throw new Error('--host and --runner must be provided together.');
  }

  const host = profile.hosts.find(candidate => candidate.id === hostId);
  if (!host) {
    fail(`unknown host ${hostId}`);
    return;
  }
  if (host.runner !== runner) {
    fail(`host ${hostId} uses ${runner}; expected ${host.runner}`);
  }
  if (host.platform !== process.platform) {
    fail(`host ${hostId} is running on ${process.platform}; expected ${host.platform}`);
  }
  if (host.architecture !== process.arch) {
    fail(`host ${hostId} is running on ${process.arch}; expected ${host.architecture}`);
  }
}

await validateSource();
validateWorkflow();
validateHost();

if (!process.exitCode) {
  console.log(`Release profile verified: Node ${profile.source.node}, npm ${profile.source.npm}.`);
}
