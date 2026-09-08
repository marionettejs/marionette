import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { glob, mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const root = fileURLToPath(new URL('../../', import.meta.url));
const sha256 = value => createHash('sha256').update(value).digest('hex');

export async function resolvePolicy(directory = root) {
  const raw = await readFile(join(directory, 'config/mutation.json'));
  const policy = JSON.parse(raw);
  if (policy.schemaVersion !== 1 || policy.concurrency !== 2 || !Number.isInteger(policy.budgetMs) ||
      policy.budgetMs < 1 || policy.budgetMs > 600000 || !policy.targets?.length || !policy.testFiles?.length) {
    throw new Error('Mutation policy requires schemaVersion 1, concurrency 2, a budget of at most 600000ms, targets and testFiles.');
  }
  const mutate = [];
  const sources = [];
  for (const target of policy.targets) {
    const path = resolve(directory, target.file);
    if (isAbsolute(target.file) || relative(directory, path).startsWith('..')) {
      throw new Error(`Mutation target must be inside the checkout: ${target.file}`);
    }
    const content = await readFile(path, 'utf8');
    sources.push({ file: target.file, sha256: sha256(content) });
    if (!target.methods) { mutate.push(target.file); continue; }
    const source = ts.createSourceFile(target.file, content, ts.ScriptTarget.Latest, true);
    for (const method of target.methods) {
      const matches = [];
      function visit(node) {
        if (ts.isMethodDeclaration(node) && node.body && node.name.getText(source) === method) { matches.push(node); }
        ts.forEachChild(node, visit);
      }
      visit(source);
      if (matches.length !== 1) { throw new Error(`Expected one ${target.file} method ${method}; found ${matches.length}.`); }
      const node = matches[0];
      const start = source.getLineAndCharacterOfPosition(node.getStart(source));
      const end = source.getLineAndCharacterOfPosition(node.end);
      mutate.push(`${target.file}:${start.line + 1}:${start.character}-${end.line + 1}:${end.character}`);
    }
  }
  return { ...policy, mutate, sources, policySha256: sha256(raw) };
}

export function summarizeReport(report, expectedFiles = []) {
  if (!report.files || typeof report.files !== 'object') { throw new Error('Mutation report has no files.'); }
  for (const file of expectedFiles) {
    if (!report.files[file]?.mutants?.length) { throw new Error(`Mutation report has no mutants for selected source ${file}.`); }
  }
  const counts = {};
  const unresolved = [];
  let total = 0;
  for (const [file, entry] of Object.entries(report.files)) {
    if (!Array.isArray(entry.mutants)) { throw new Error(`Mutation report lacks mutants for ${file}.`); }
    for (const mutant of entry.mutants) {
      if (!['Killed', 'Survived', 'NoCoverage', 'Timeout', 'CompileError', 'RuntimeError', 'Ignored', 'Pending'].includes(mutant.status)) {
        throw new Error(`Unknown mutation status: ${mutant.status}`);
      }
      counts[mutant.status] = (counts[mutant.status] ?? 0) + 1;
      total++;
      if (mutant.status !== 'Killed') {
        unresolved.push({ file, id: mutant.id, status: mutant.status, mutatorName: mutant.mutatorName,
          location: mutant.location, replacement: mutant.replacement, statusReason: mutant.statusReason });
      }
    }
  }
  if (!total) { throw new Error('Mutation report contains no mutants.'); }
  const detected = (counts.Killed ?? 0) + (counts.Timeout ?? 0);
  const undetected = (counts.Survived ?? 0) + (counts.NoCoverage ?? 0);
  return { total, counts, mutationScore: detected + undetected ? 100 * detected / (detected + undetected) : null,
    complete: !(counts.Pending || counts.RuntimeError), unresolved };
}

// The process group owns every worker. Its deadline also applies to a hung baseline run.
export function runBudgeted(command, args, options) {
  return new Promise((resolveRun, reject) => {
    const log = createWriteStream(options.logFile);
    const child = spawn(command, args, { cwd: options.cwd, env: options.env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    let timedOut = false;
    let killTimer;
    function stop(signal) {
      try {
        if (process.platform === 'win32') { spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']); } else { process.kill(-child.pid, signal); }
      } catch (error) { if (error.code !== 'ESRCH') { log.write(`${error.message}\n`); } }
    }
    const graceMs = Math.min(2000, Math.floor(options.budgetMs / 4));
    const timer = setTimeout(() => {
      timedOut = true;
      stop('SIGTERM');
      killTimer = setTimeout(() => stop('SIGKILL'), graceMs);
    }, options.budgetMs - graceMs);
    child.stdout.on('data', data => { log.write(data); process.stdout.write(data); });
    child.stderr.on('data', data => { log.write(data); process.stderr.write(data); });
    child.on('error', error => { clearTimeout(timer); clearTimeout(killTimer); log.end(); reject(error); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      // A parent may exit while a worker survives. Always reap our own group on timeout.
      if (timedOut) { stop('SIGKILL'); }
      log.end(() => resolveRun({ code, signal, timedOut }));
    });
  });
}

export async function main(args = process.argv.slice(2)) {
  if (args.length) { throw new Error('Usage: node scripts/testing/mutation.mjs (policy: config/mutation.json)'); }
  const policy = await resolvePolicy();
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
  const output = join(root, 'coverage/mutation', runId);
  await mkdir(output, { recursive: true });
  const startedAt = new Date().toISOString();
  const testInputs = [];
  for await (const file of glob([...policy.testFiles, 'test/unit/model-based/*.js', 'test/setup/*.js', 'vitest.config.js', 'stryker.config.mjs', 'scripts/testing/mutation.mjs'], { cwd: root })) {
    testInputs.push({ file, sha256: sha256(await readFile(join(root, file))) });
  }
  testInputs.sort((first, second) => first.file.localeCompare(second.file));
  const provenance = { schemaVersion: 1, startedAt, node: process.version, policy,
    testInputs,
    modelEnvironment: Object.fromEntries(['MARIONETTE_MODEL_SEED', 'MARIONETTE_MODEL_RUNS', 'MARIONETTE_MODEL_STEPS', 'MARIONETTE_MODEL_PATH', 'MARIONETTE_MODEL_REPLAY_PATH']
      .map(name => [name, process.env[name] ?? null])),
    sourceCommit: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim(),
    sourceStatus: spawnSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }).stdout.trim(),
    lockSha256: sha256(await readFile(join(root, 'package-lock.json'))),
    strykerVersion: JSON.parse(await readFile(join(root, 'node_modules/@stryker-mutator/core/package.json'))).version };
  await writeFile(join(output, 'provenance.json'), `${JSON.stringify(provenance, null, 2)}\n`);
  console.log(`Mutation artifacts: ${output}`);
  const outcome = await runBudgeted(process.execPath, [join(root, 'node_modules/@stryker-mutator/core/bin/stryker.js'), 'run', 'stryker.config.mjs'], {
    cwd: root, env: { ...process.env, MARIONETTE_MUTATION_RUN_ID: runId }, budgetMs: policy.budgetMs, logFile: join(output, 'run.log')
  });
  const summary = { ...outcome, startedAt, finishedAt: new Date().toISOString(), complete: false };
  try {
    Object.assign(summary, summarizeReport(JSON.parse(await readFile(join(output, 'mutation.json'), 'utf8')), policy.sources.map(source => source.file)));
  } catch (error) { summary.reportError = error.message; }
  summary.complete = summary.complete && !outcome.timedOut && outcome.code === 0;
  await writeFile(join(output, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify({ output, ...summary, unresolved: summary.unresolved?.length }, null, 2));
  if (!summary.complete) { process.exitCode = 1; }
  return summary;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
