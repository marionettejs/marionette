import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { evaluateAttempt, loadCorpus, prepareArtifacts, prepareAttempt } from './harness.mjs';

const parsed = parseArgs({ options: {
  output: { type: 'string' }, manifest: { type: 'string' }, task: { type: 'string' },
  attempt: { type: 'string' }, aborted: { type: 'boolean' }
}, allowPositionals: true, tokens: true });
const seen = new Set();
for (const token of parsed.tokens.filter(entry => entry.kind === 'option')) {
  if (seen.has(token.name)) { throw new Error(`Repeated option: --${token.name}`); }
  seen.add(token.name);
}
const [mode] = parsed.positionals;
if (parsed.positionals.length !== 1 || !['reference', 'fixtures', 'prepare', 'evaluate'].includes(mode)) {
  throw new Error('Choose reference, fixtures, prepare, or evaluate');
}
const options = parsed.values;
if (mode === 'evaluate' && (!options.attempt || options.task || options.manifest || options.output)) { throw new Error('evaluate requires only --attempt and optional --aborted'); }
if (mode !== 'evaluate' && (options.attempt || options.aborted)) { throw new Error('--attempt and --aborted apply only to evaluate'); }
if (mode === 'prepare' && !options.task) { throw new Error('prepare requires --task'); }
const output = mode === 'evaluate' ? undefined : (options.output ? resolve(options.output) : await mkdtemp(join(tmpdir(), 'marionette-agent-')));
if (mode === 'evaluate') {
  const attempt = options.attempt;
  if (!attempt) { throw new Error('evaluate requires --attempt'); }
  const result = await evaluateAttempt({ attempt: resolve(attempt), aborted: Boolean(options.aborted) });
  console.log(JSON.stringify(result, null, 2));
  if (!result.acceptancePassed) { process.exitCode = 1; }
} else if (mode === 'reference' || mode === 'fixtures' || mode === 'prepare') {
  if (options.output) { await mkdir(dirname(output), { recursive: true }); await mkdir(output); }
  const corpus = await loadCorpus();
  const selected = options.task;
  const tasks = selected ? corpus.tasks.filter(task => task.id === selected) : corpus.tasks;
  if (mode === 'prepare' && !selected) { throw new Error('prepare requires --task'); }
  if (!tasks.length) { throw new Error(`Unknown task: ${selected}`); }
  const artifacts = await prepareArtifacts({ manifestPath: options.manifest, output: join(output, 'artifacts') });
  const results = [];
  for (const task of tasks) {
    const prepared = await prepareAttempt({ taskId: task.id, artifacts, output: join(output, task.id), reference: mode === 'reference' });
    if (mode === 'prepare') { console.log(JSON.stringify(prepared, null, 2)); continue; }
    const result = await evaluateAttempt({ attempt: prepared.attempt });
    results.push(result);
    const correctControl = mode === 'fixtures' ? !result.acceptancePassed && result.exitCode === 1 : result.acceptancePassed;
    console.log(`${correctControl ? 'PASS' : 'FAIL'} ${task.id}${result.failure ? `: ${result.failure}` : ''}`);
    if (!correctControl) { console.log(result.stdout, result.stderr); }
  }
  if (mode !== 'prepare') {
    const reportFile = mode === 'fixtures' ? 'fixture-controls.json' : 'reference-report.json';
    await writeFile(join(output, reportFile), `${JSON.stringify({ schemaVersion: 1, kind: mode === 'fixtures' ? 'unfinished-fixture-controls' : 'known-reference-verification', scored: false, results }, null, 2)}\n`, { flag: 'wx' });
    console.log(`Control report: ${join(output, reportFile)}`);
    if (results.some(result => mode === 'fixtures' ? result.acceptancePassed || result.exitCode !== 1 : !result.acceptancePassed)) { process.exitCode = 1; }
  }
} else {
  throw new Error('Usage: run.mjs reference|fixtures|prepare|evaluate [--manifest release-evidence.json] [--task id] [--output directory] [--attempt directory] [--aborted]');
}
