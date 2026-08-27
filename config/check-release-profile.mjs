import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const root = resolve(import.meta.dirname, '..');
const profile = await readJson('config/release-profile.json');
const packageJson = await readJson('package.json');
const packageLock = await readJson('package-lock.json');
const nvmVersion = (await readFile(resolve(root, '.nvmrc'), 'utf8')).trim();
const workflowDir = resolve(root, '.github/workflows');
const workflowFiles = (await readdir(workflowDir))
  .filter(file => /\.ya?ml$/.test(file))
  .sort();
const workflowContents = new Map(await Promise.all(workflowFiles.map(async file => {
  return [file, await readFile(resolve(workflowDir, file), 'utf8')];
})));
const ciWorkflow = [...workflowContents.entries()]
  .map(([file, workflow]) => `# ${file}\n${workflow}`)
  .join('\n');
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

  const npmPackagePath = resolve(dirname(npmExecPath), '..', 'package.json');
  const npmPackage = JSON.parse(await readFile(npmPackagePath, 'utf8'));
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
  for (const [file, workflow] of workflowContents) {
    const explicitNodeVersions = [...workflow.matchAll(/^\s+node-version:\s+(\S+)\s*$/gm)];
    for (const [, version] of explicitNodeVersions) {
      if (file !== profile.source.advisoryWorkflow || version !== profile.source.advisoryNodeMajor) {
        fail(`${file} uses unapproved explicit Node version ${version}`);
      }
    }
  }

  const advisoryWorkflow = workflowContents.get(profile.source.advisoryWorkflow);
  const advisoryVersion = profile.source.advisoryNodeMajor;
  const advisoryVersions = advisoryWorkflow ?
    [...advisoryWorkflow.matchAll(/^\s+node-version:\s+(\S+)\s*$/gm)] :
    [];
  if (advisoryVersions.length !== 1 || advisoryVersions[0][1] !== advisoryVersion) {
    fail(`${profile.source.advisoryWorkflow} does not test Node ${advisoryVersion}`);
  }

  const advisoryJobs = advisoryWorkflow?.split(/^jobs:\s*$/m)[1] || '';
  const advisoryJobIds = [...advisoryJobs.matchAll(/^ {2}([a-z0-9-]+):\s*$/gm)]
    .map(([, jobId]) => jobId);
  if (advisoryJobIds.length !== 1 || advisoryJobIds[0] !== profile.source.advisoryJob) {
    fail(`${profile.source.advisoryWorkflow} must contain only ${profile.source.advisoryJob}`);
  }
  if (!/^ {4}continue-on-error:\s+true\s*$/m.test(advisoryJobs)) {
    fail(`${profile.source.advisoryJob} must remain nonblocking`);
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
