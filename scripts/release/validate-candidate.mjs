import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { readArguments } from './arguments.mjs';
import { candidateChecks, containedArtifactPath, digest, verifyCandidateValidation } from './validation.mjs';

const root = resolve(import.meta.dirname, '../..');
const args = readArguments({ 'artifact-dir': { type: 'string', default: 'release' } });
const directory = resolve(root, args['artifact-dir']);
const npmCli = process.env.npm_execpath;

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (result.error) { throw result.error; }
  if (result.status !== 0) {
    throw new Error(`${command} failed (${result.status}): ${result.stdout}\n${result.stderr}`);
  }
  return result.stdout.trim();
}

function assertCleanSource() {
  const outputPath = relative(root, directory);
  const statusArgs = ['status', '--short', '--untracked-files=all'];
  if (outputPath && !isAbsolute(outputPath) && outputPath !== '..' && !outputPath.startsWith(`..${sep}`)) {
    statusArgs.push('--', '.', `:(top,literal,exclude)${outputPath.split(sep).join('/')}`);
  }
  if (run('git', statusArgs)) {
    throw new Error('Candidate validation requires a clean source checkout.');
  }
}

// Starting a new attempt revokes previous certification even if preflight fails.
await rm(resolve(directory, 'candidate-validation.json'), { force: true });
await rm(resolve(directory, 'candidate-validation.sha512'), { force: true });
if (!npmCli) { throw new Error('Run release:validate through npm.'); }
assertCleanSource();
run(process.execPath, [resolve(root, 'scripts/release/verify-artifact.mjs'), '--artifact-dir', directory]);
const evidenceBytes = await readFile(resolve(directory, 'release-evidence.json'));
const evidence = JSON.parse(evidenceBytes);
const report = {
  schemaVersion: 1,
  sourceCommit: evidence.source.commit,
  evidenceSha512: digest(evidenceBytes),
  status: 'running',
  checks: [],
  attachments: [],
};
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'marionette-candidate-'));
const packageDirectories = new Map();

async function saveReport() {
  const text = `${JSON.stringify(report, null, 2)}\n`;
  await writeFile(resolve(directory, 'candidate-validation.json'), text);
  await writeFile(resolve(directory, 'candidate-validation.sha512'), `${digest(text)}  candidate-validation.json\n`);
}

async function attachment(source, file) {
  const destination = containedArtifactPath(directory, file);
  if (source !== destination) { await copyFile(source, destination); }
  report.attachments.push({ file, sha512: digest(await readFile(destination)) });
}

async function check({ id, script }) {
  const commandArgs = [npmCli, 'run', script];
  if (id === 'distribution') { commandArgs.push('--', '--root', packageDirectories.get('core')); }
  if (id === 'fixtures') {
    commandArgs.push('--', '--artifact-dir', directory, '--report', resolve(directory, 'fixtures-report.json'));
  }
  const file = `validation-${id}.log`;
  const output = createWriteStream(resolve(directory, file));
  const started = Date.now();
  console.log(`\nCandidate check ${id}: npm ${commandArgs.slice(1).join(' ')}`);
  const result = await new Promise(resolveResult => {
    const child = spawn(process.execPath, commandArgs, {
      cwd: root,
      timeout: 15 * 60 * 1000,
      env: { ...process.env, MARIONETTE_BROWSER_ARTIFACT_MANIFEST: resolve(directory, 'release-evidence.json') },
    });
    child.stdout.on('data', chunk => { output.write(chunk); process.stdout.write(chunk); });
    child.stderr.on('data', chunk => { output.write(chunk); process.stderr.write(chunk); });
    let spawnError;
    child.on('error', error => { spawnError = error; });
    child.on('close', (code, signal) => output.end(() => resolveResult({ code, signal, error: spawnError?.message })));
  });
  const passed = result.code === 0 && !result.signal && !result.error;
  report.checks.push({
    id, script, status: passed ? 'passed' : 'failed', exitCode: result.code,
    durationMs: Date.now() - started, signal: result.signal, error: result.error,
    command: [process.execPath, ...commandArgs],
    log: { file, sha512: digest(await readFile(resolve(directory, file))) },
  });
  await saveReport();
  if (!passed) { throw new Error(`Candidate check ${id} failed. See ${resolve(directory, file)}.`); }
  if (id === 'browser') {
    await attachment(resolve(root, 'test/tmp/browser/results.json'), 'browser-results.json');
    await attachment(resolve(root, 'test/tmp/browser/candidate.json'), 'browser-candidate.json');
  }
  if (id === 'fixtures') { await attachment(resolve(directory, 'fixtures-report.json'), 'fixtures-report.json'); }
}

try {
  await saveReport();
  for (const entry of evidence.packages) {
    const destination = resolve(temporaryDirectory, entry.id);
    await mkdir(destination);
    run('tar', ['-xzf', containedArtifactPath(directory, entry.tarball.file), '-C', destination]);
    packageDirectories.set(entry.id, resolve(destination, 'package'));
  }
  // The distribution validator runs as an installed core consumer, outside the checkout.
  for (const id of ['utils', 'radio']) {
    const entry = evidence.packages.find(candidate => candidate.id === id);
    const destination = resolve(packageDirectories.get('core'), 'node_modules', entry.name);
    await mkdir(dirname(destination), { recursive: true });
    await mkdir(destination);
    run('tar', ['-xzf', containedArtifactPath(directory, entry.tarball.file), '--strip-components=1', '-C', destination]);
  }
  for (const currentCheck of candidateChecks) { await check(currentCheck); }
  // Never certify a report if the source or immutable inputs changed during validation.
  assertCleanSource();
  run(process.execPath, [resolve(root, 'scripts/release/verify-artifact.mjs'), '--artifact-dir', directory]);
  if (digest(await readFile(resolve(directory, 'release-evidence.json'))) !== report.evidenceSha512) {
    throw new Error('Release evidence changed during candidate validation.');
  }
  report.status = 'passed';
  await saveReport();
  await verifyCandidateValidation(directory, evidenceBytes);
  console.log(`Verified all ${report.checks.length} candidate checks for ${report.sourceCommit}.`);
} catch (error) {
  report.status = 'failed';
  report.error = error.message;
  await saveReport();
  throw error;
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
