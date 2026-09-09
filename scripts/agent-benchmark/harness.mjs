import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { cp, copyFile, lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import nodePath, { basename, dirname, join, resolve } from 'node:path';
import { validateTaskContracts } from './task-contract.mjs';

export const repositoryRoot = resolve(import.meta.dirname, '../..');
const packageDefinitions = [
  ['utils', '@mnjs/utils', 'packages/utils'], ['radio', '@mnjs/radio', 'packages/radio'],
  ['core', 'marionette', '.'], ['data', '@mnjs/data', 'packages/data'],
  ['adapters', '@mnjs/adapters', 'packages/adapters']
];
const digest = bytes => createHash('sha512').update(bytes).digest('hex');
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const save = (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
export function isWithin(parent, child, pathApi = nodePath) {
  const childRelativePath = pathApi.relative(parent, child);
  return childRelativePath !== '..' && !childRelativePath.startsWith(`..${pathApi.sep}`) && !pathApi.isAbsolute(childRelativePath);
}

function execute(command, args, cwd, timeout = 120000) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout, maxBuffer: 8 * 1024 * 1024, shell: false });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} failed: ${result.error?.message || result.stderr || result.stdout}`);
  }
  return result.stdout;
}

export async function loadCorpus(root = repositoryRoot) {
  const corpus = await readJson(join(root, 'benchmarks/agent/corpus.json'));
  if (corpus.schemaVersion !== 1 || corpus.status !== 'prototype-unscored') { throw new Error('Unsupported corpus contract'); }
  await validateTaskContracts({ root, tasks: corpus.tasks });
  const catalog = await readJson(join(root, 'benchmarks/agent/capabilities.json'));
  const decisions = await readJson(join(root, 'benchmarks/agent/series-decisions.json'));
  for (const capability of catalog.capabilities) {
    if (corpus.tasks.filter(task => task.capabilities.includes(capability.id)).length < catalog.coverage.minimumIndependentTasksPerCapability) {
      throw new Error(`Capability needs independent tasks: ${capability.id}`);
    }
  }
  if (decisions.tasks.length !== corpus.tasks.length || new Set(decisions.tasks.map(task => task.id)).size !== corpus.tasks.length ||
      decisions.tasks.some(task => !corpus.tasks.some(entry => entry.id === task.id))) { throw new Error('Series decisions must identify every task exactly once'); }
  return corpus;
}

// Inventory uses real files only. This is a filesystem isolation check, not a test of
// framework internals. A future agent runner must separately enforce OS permissions.
export async function inventory(directory, prefix = '') {
  const result = {};
  const directoryInfo = await lstat(directory);
  if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) { throw new Error(`Expected a real directory: ${directory}`); }
  for (const name of (await readdir(directory)).sort()) {
    const path = join(directory, name);
    const info = await lstat(path);
    if (info.isSymbolicLink() || (!info.isFile() && !info.isDirectory())) { throw new Error(`Workspace contains a link or special file: ${path}`); }
    if (info.isFile()) {
      if (info.nlink !== 1) { throw new Error(`Workspace contains a hard link: ${path}`); }
      result[`${prefix}${name}`] = digest(await readFile(path));
    } else {
      Object.assign(result, await inventory(path, `${prefix}${name}/`));
    }
  }
  return result;
}

export async function prepareArtifacts({ root = repositoryRoot, manifestPath, output }) {
  await mkdir(output, { recursive: true });
  let manifest;
  let directory;
  if (manifestPath) {
    directory = dirname(resolve(manifestPath));
    manifest = await readJson(resolve(manifestPath));
  } else {
    directory = output;
    manifest = { schemaVersion: 3, packages: [] };
    for (const [id, name, path] of packageDefinitions) {
      const packed = JSON.parse(execute('npm', ['pack', resolve(root, path), '--ignore-scripts', '--json', '--pack-destination', directory], root));
      if (packed.length !== 1 || packed[0].name !== name) { throw new Error(`Expected exactly one ${name} package`); }
      const bytes = await readFile(join(directory, packed[0].filename));
      manifest.packages.push({ id, name, version: packed[0].version, tarball: { file: packed[0].filename, sha512: digest(bytes), integrity: packed[0].integrity, size: bytes.length } });
    }
  }
  if (manifest.schemaVersion !== 3 || manifest.packages?.length !== 5) { throw new Error('Expected schema 3 evidence with all five packages'); }
  const packages = [];
  for (const [id, name] of packageDefinitions) {
    const entries = manifest.packages.filter(entry => entry.id === id);
    const entry = entries[0];
    if (entries.length !== 1 || entry.name !== name || entry.version !== manifest.packages[0].version ||
        (manifest.release && entry.version !== manifest.release.version)) { throw new Error(`Invalid artifact identity: ${name}`); }
    const filename = entry.tarball?.file;
    if (!filename || filename !== basename(filename) || /[\\/:]/.test(filename) || filename === '.' || filename === '..') { throw new Error('Artifact filename must be contained'); }
    const source = join(directory, filename);
    const bytes = await readFile(source);
    if (entry.tarball.size !== bytes.length || entry.tarball.sha512 !== digest(bytes) ||
        entry.tarball.integrity !== `sha512-${createHash('sha512').update(bytes).digest('base64')}`) { throw new Error(`Artifact integrity mismatch: ${name}`); }
    const packedManifest = JSON.parse(execute('tar', ['-xOf', source, 'package/package.json'], root));
    if (packedManifest.name !== name || packedManifest.version !== entry.version) { throw new Error(`Packed identity mismatch: ${name}`); }
    const destination = join(output, filename);
    if (resolve(source) !== resolve(destination)) { await copyFile(source, destination, constants.COPYFILE_EXCL); }
    packages.push({ ...entry, path: destination });
  }
  await save(join(output, 'artifact-input.json'), { schemaVersion: 3, source: manifest.source || null, packages: packages.map(({ path, ...entry }) => entry) });
  return { source: manifest.source || null, packages };
}

async function harnessHashes(root) {
  const paths = ['scripts/agent-benchmark/harness.mjs', 'scripts/agent-benchmark/task-contract.mjs', 'benchmarks/agent/task.schema.json', 'benchmarks/agent/capabilities.json', 'benchmarks/agent/series-decisions.json', 'benchmarks/agent/support/dependency-lock.json', 'benchmarks/agent/evaluator.json', 'config/diagnostics/catalog.json'];
  return Object.fromEntries(await Promise.all(paths.map(async path => [path, digest(await readFile(join(root, path)))])));
}

export async function prepareAttempt({ root = repositoryRoot, taskId, artifacts, output, reference = false }) {
  const corpus = await loadCorpus(root);
  const task = corpus.tasks.find(entry => entry.id === taskId);
  if (!task) { throw new Error(`Unknown task: ${taskId}`); }
  // mkdir without recursive/existing-directory reuse makes attempts append-only.
  await mkdir(output);
  const workspace = join(output, 'workspace');
  await cp(join(root, task.workspacePath), workspace, { recursive: true, errorOnExist: true });
  await copyFile(join(root, task.promptPath), join(workspace, 'PROMPT.md'), constants.COPYFILE_EXCL);
  const sealed = { harness: await harnessHashes(root), task: digest(JSON.stringify(task)), prompt: digest(await readFile(join(root, task.promptPath))), fixture: await inventory(join(root, task.workspacePath)), acceptance: {} };
  for (const hidden of task.acceptance.hiddenTests) { sealed.acceptance[hidden.sourcePath] = digest(await readFile(join(root, hidden.sourcePath))); }
  const referencePath = join(root, dirname(task.workspacePath), 'reference/solution.mjs');
  if (reference) { await copyFile(referencePath, join(workspace, 'solution.mjs')); }
  for (const entry of artifacts.packages) {
    if (digest(await readFile(entry.path)) !== entry.tarball.sha512) { throw new Error(`Artifact changed before installation: ${entry.name}`); }
  }
  const environmentLock = await readJson(join(root, 'benchmarks/agent/support/dependency-lock.json'));
  const packageManifest = await readJson(join(workspace, 'package.json'));
  packageManifest.dependencies = { jsdom: '30.0.1' };
  environmentLock.name = packageManifest.name;
  environmentLock.packages[''].name = packageManifest.name;
  await writeFile(join(workspace, 'package.json'), JSON.stringify(packageManifest, null, 2));
  await save(join(workspace, 'package-lock.json'), environmentLock);
  // Keep jsdom resolved by the checked-in lock: requesting it again needs a registry
  // packument that npm ci does not cache when warming the pinned environment.
  execute('npm', ['install', '--ignore-scripts', '--offline', '--no-audit', '--no-fund', '--save-exact', ...artifacts.packages.map(entry => entry.path)], workspace);
  const installedLock = await readJson(join(workspace, 'package-lock.json'));
  for (const [path, entry] of Object.entries(environmentLock.packages)) {
    if (path && (installedLock.packages[path]?.version !== entry.version || installedLock.packages[path]?.integrity !== entry.integrity)) { throw new Error(`Pinned environment dependency changed: ${path}`); }
  }
  // npm creates command convenience symlinks; they are not needed by these tasks.
  await rm(join(workspace, 'node_modules/.bin'), { recursive: true, force: true });
  const dependencies = await inventory(join(workspace, 'node_modules'));
  const record = {
    schemaVersion: 1, attemptId: randomUUID(), kind: reference ? 'reference-verification' : 'local-unscored-attempt',
    taskId, task, sealed, runtime: { node: process.version, npm: execute('npm', ['--version'], root).trim(), jsdom: '30.0.1' },
    packages: artifacts.packages.map(({ path, ...entry }) => entry), packageSource: artifacts.source,
    dependencies, packageManifest: digest(await readFile(join(workspace, 'package.json'))), lockfile: digest(await readFile(join(workspace, 'package-lock.json')))
  };
  await save(join(output, 'attempt.json'), record);
  return { attempt: output, workspace, taskId, kind: record.kind };
}

export async function installAcceptance({ root, task, workspace }) {
  await inventory(workspace);
  for (const hidden of task.acceptance.hiddenTests) {
    const target = resolve(workspace, hidden.targetPath);
    if (!isWithin(workspace, target)) { throw new Error('Hidden target escapes workspace'); }
    await copyFile(join(root, hidden.sourcePath), target, constants.COPYFILE_EXCL);
  }
}

export function evaluateOutcome({ aborted, exitCode, signal, tests, passed, failed, violations, expectedCases = [], observedCases = [] }) {
  return { attempted: true, aborted, acceptancePassed: !aborted && exitCode === 0 && !signal && tests > 0 && passed === tests && failed === 0 && expectedCases.length === tests &&
      JSON.stringify([...observedCases].sort()) === JSON.stringify([...expectedCases].sort()),
  uniqueArchitectureViolations: [...new Set(violations)].sort() };
}

export async function evaluateAttempt({ root = repositoryRoot, attempt, aborted = false, violations = [], architectureReviewed = false, timeout = 30000 }) {
  const record = await readJson(join(attempt, 'attempt.json'));
  const corpus = await loadCorpus(root);
  const task = corpus.tasks.find(entry => entry.id === record.taskId);
  const evaluator = await readJson(join(root, 'benchmarks/agent/evaluator.json'));
  const expectedCases = evaluator.expectedCases[record.taskId];
  if (!expectedCases?.length) { throw new Error('Missing expected acceptance cases'); }
  const diagnosticCatalog = await readJson(join(root, 'config/diagnostics/catalog.json'));
  const knownCodes = new Set(diagnosticCatalog.diagnostics.map(entry => entry.code));
  if (!Array.isArray(violations) || violations.some(code => !knownCodes.has(code))) { throw new Error('Architecture violations must use known catalog codes'); }
  const resultPath = join(attempt, 'result.json');
  try { await lstat(resultPath); throw new Error('Attempt already evaluated'); } catch (error) { if (error.code !== 'ENOENT') { throw error; } }
  await save(join(attempt, 'evaluation-lock.json'), { attemptId: record.attemptId });
  const evaluationRuntime = { node: process.version, executable: process.execPath, platform: process.platform, arch: process.arch };
  let failure;
  let execution;
  let snapshot;
  let evaluation;
  try {
    if (aborted) { throw new Error('Attempt aborted before acceptance'); }
    if (record.runtime?.node !== evaluationRuntime.node) {
      throw new Error(`Evaluator Node version changed since preparation: expected ${record.runtime?.node}; actual ${evaluationRuntime.node}`);
    }
    if (JSON.stringify(await harnessHashes(root)) !== JSON.stringify(record.sealed.harness)) { throw new Error('Harness/profile/environment changed after preparation'); }
    if (!task || digest(JSON.stringify(task)) !== record.sealed.task ||
        digest(await readFile(join(root, task.promptPath))) !== record.sealed.prompt ||
        JSON.stringify(await inventory(join(root, task.workspacePath))) !== JSON.stringify(record.sealed.fixture)) { throw new Error('Task artifacts changed after preparation'); }
    for (const hidden of task.acceptance.hiddenTests) {
      if (digest(await readFile(join(root, hidden.sourcePath))) !== record.sealed.acceptance[hidden.sourcePath]) { throw new Error('Hidden acceptance changed after preparation'); }
    }
    const workspace = join(attempt, 'workspace');
    snapshot = await inventory(workspace);
    if (JSON.stringify(await inventory(join(workspace, 'node_modules'))) !== JSON.stringify(record.dependencies) ||
        digest(await readFile(join(workspace, 'package.json'))) !== record.packageManifest ||
        digest(await readFile(join(workspace, 'package-lock.json'))) !== record.lockfile) { throw new Error('Attempt modified pinned dependencies'); }
    evaluation = await mkdtemp(join(tmpdir(), 'marionette-agent-evaluate-'));
    await cp(workspace, evaluation, { recursive: true });
    await installAcceptance({ root, task, workspace: evaluation });
    const [command, ...args] = task.acceptance.command;
    if (command !== 'node') { throw new Error('Local evaluator supports pinned Node acceptance only'); }
    execution = spawnSync(process.execPath, args, { cwd: evaluation, encoding: 'utf8', timeout,
      maxBuffer: 1024 * 1024, shell: false, env: { PATH: process.env.PATH, LANG: 'C', TZ: 'UTC' } });
    if (execution.error) { failure = execution.error.message; }
  } catch (error) { failure = error.message; } finally { if (evaluation) { await rm(evaluation, { recursive: true, force: true }); } }
  const stdout = execution?.stdout || '';
  const count = label => Number(stdout.match(new RegExp(`^# ${label} (\\d+)$`, 'm'))?.[1] || 0);
  const observedCases = [...stdout.matchAll(/^ok \d+ - (.+)$/gm)].map(match => match[1]);
  const outcome = evaluateOutcome({ expectedCases, observedCases, aborted: aborted || execution?.error?.code === 'ETIMEDOUT' || Boolean(execution?.signal), exitCode: execution?.status, signal: execution?.signal, tests: count('tests'), passed: count('pass'), failed: count('fail'), violations });
  const result = { schemaVersion: 1, attemptId: record.attemptId, kind: record.kind, taskId: record.taskId, ...outcome,
    fullyCorrect: outcome.aborted || !outcome.acceptancePassed ? false : (architectureReviewed ? outcome.uniqueArchitectureViolations.length === 0 : null),
    architectureReview: architectureReviewed ? 'caller-reviewed' : 'uncollected', scored: false,
    expectedCases, observedCases, sealed: record.sealed, runtime: record.runtime, evaluationRuntime, packages: record.packages,
    submissionSha512: snapshot ? digest(JSON.stringify(snapshot)) : null, failure: failure || null,
    exitCode: execution?.status ?? null, signal: execution?.signal || null, stdout, stderr: execution?.stderr || '' };
  await save(resultPath, result);
  return result;
}
