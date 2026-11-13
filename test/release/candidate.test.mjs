import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { fixture, successfulValidation } from './fixture.mjs';

async function orchestrator(t) {
  const candidate = await fixture(t);
  const { reports } = await successfulValidation(candidate);
  const calls = resolve(candidate.directory, 'npm-calls.jsonl');
  await writeFile(calls, '');
  await writeFile(candidate.npmCli, `
const { appendFileSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const assert = require('node:assert/strict');
const args = process.argv.slice(2);
const reports = ${JSON.stringify(reports)};
const artifactDir = ${JSON.stringify(candidate.artifacts)};
appendFileSync(${JSON.stringify(calls)}, JSON.stringify({ args, manifest: process.env.MARIONETTE_BROWSER_ARTIFACT_MANIFEST }) + '\\n');
assert.equal(args[0], 'run');
assert.equal(process.env.MARIONETTE_BROWSER_ARTIFACT_MANIFEST, resolve(artifactDir, 'release-evidence.json'));
if (args[1] === 'test:dist') {
  assert.deepEqual(args.slice(2, 4), ['--', '--root']);
  assert.ok(!args[4].startsWith(process.cwd()));
  for (const [relative, name] of [['package.json', 'marionette'], ['node_modules/@mnjs/utils/package.json', '@mnjs/utils'], ['node_modules/@mnjs/radio/package.json', '@mnjs/radio']]) {
    assert.equal(JSON.parse(readFileSync(resolve(args[4], relative))).name, name);
  }
}
if (args[1] === 'test:browser:core-release') {
  mkdirSync('test/tmp/browser', { recursive: true });
  writeFileSync('test/tmp/browser/results.json', JSON.stringify(reports['browser-results.json']));
  writeFileSync('test/tmp/browser/candidate.json', JSON.stringify(reports['browser-candidate.json']));
}
if (args[1] === 'test:fixtures') {
  assert.deepEqual(args.slice(2), ['--', '--artifact-dir', artifactDir, '--report', resolve(artifactDir, 'fixtures-report.json')]);
  writeFileSync(args[6], JSON.stringify(reports['fixtures-report.json']));
  if (process.env.RELEASE_TEST_MUTATION === 'source') { writeFileSync('uncommitted.js', 'source changed during validation'); }
  if (process.env.RELEASE_TEST_MUTATION === 'artifact') { writeFileSync(resolve(artifactDir, 'utils.tgz'), 'changed during validation'); }
  if (process.env.RELEASE_TEST_MUTATION === 'evidence') {
    const path = resolve(artifactDir, 'release-evidence.json');
    const text = JSON.stringify({ ...JSON.parse(readFileSync(path)), changedDuringValidation: true });
    writeFileSync(path, text);
    const hash = require('node:crypto').createHash('sha512').update(text).digest('hex');
    writeFileSync(resolve(artifactDir, 'release-evidence.sha512'), hash + '  release-evidence.json\\n');
  }
}
console.log(args[1] + ' passed');
`);
  return { ...candidate, calls, reports };
}

test('candidate orchestration validates every check against the exact isolated packed artifacts', async t => {
  const candidate = await orchestrator(t);
  const result = candidate.run('validate-candidate', ['--artifact-dir', candidate.artifacts]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(await readFile(resolve(candidate.artifacts, 'candidate-validation.json')));
  assert.equal(report.status, 'passed');
  assert.equal(report.sourceCommit, candidate.commit);
  assert.deepEqual(report.checks.map(entry => entry.id), ['profile', 'browser-profile', 'diagnostics', 'api-contracts', 'public-tests', 'workflows',
    'source-types', 'consumer-types', 'lint', 'tooling', 'source', 'coverage', 'documentation', 'distribution', 'browser', 'fixtures']);
  const calls = (await readFile(candidate.calls, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(calls.map(entry => entry.args[1]), report.checks.map(entry => entry.script));
  for (const entry of report.checks) {
    assert.equal(entry.exitCode, 0);
    assert.equal(entry.status, 'passed');
    assert.ok(entry.durationMs >= 0);
    assert.match(await readFile(resolve(candidate.artifacts, entry.log.file), 'utf8'), new RegExp(`${entry.script} passed`));
  }
  for (const [file, data] of Object.entries(candidate.reports)) {
    assert.deepEqual(JSON.parse(await readFile(resolve(candidate.artifacts, file))), data);
  }
  await assert.rejects(readFile(resolve(calls.find(entry => entry.args[1] === 'test:dist').args[4], 'package.json')), { code: 'ENOENT' });
  const verification = candidate.run('verify-artifact', ['--artifact-dir', candidate.artifacts, '--require-validation']);
  assert.equal(verification.status, 0, verification.stderr);
});

for (const mutation of ['source', 'artifact', 'evidence']) {
  test(`candidate orchestration cannot certify ${mutation} changes made during checks`, async t => {
    const candidate = await orchestrator(t);
    const result = candidate.run('validate-candidate', ['--artifact-dir', candidate.artifacts], { RELEASE_TEST_MUTATION: mutation });
    assert.equal(result.status, 1);
    const report = JSON.parse(await readFile(resolve(candidate.artifacts, 'candidate-validation.json')));
    assert.equal(report.status, 'failed');
    assert.equal(report.checks.length, 16);
    assert.match(report.error, mutation === 'source' ? /clean source checkout/ : mutation === 'artifact' ? /tarball size mismatch/ : /evidence changed/);
    if (mutation === 'source') { await rm(resolve(candidate.root, 'uncommitted.js')); }
    const verify = candidate.run('verify-artifact', ['--artifact-dir', candidate.artifacts, '--require-validation']);
    assert.equal(verify.status, 1);
  });
}

test('a rejected dirty-source retry revokes old success even after the source is restored', async t => {
  const candidate = await fixture(t);
  await successfulValidation(candidate);
  const dirty = resolve(candidate.root, 'uncommitted.js');
  await writeFile(dirty, 'changed');
  const rejected = candidate.run('validate-candidate', ['--artifact-dir', candidate.artifacts]);
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /clean source checkout/);
  await rm(dirty);
  const verify = candidate.run('verify-artifact', ['--artifact-dir', candidate.artifacts, '--require-validation']);
  assert.equal(verify.status, 1);
  assert.match(verify.stderr, /candidate-validation.json/);
});

test('an invalid-artifact retry revokes old success before preflight fails', async t => {
  const candidate = await fixture(t);
  await successfulValidation(candidate);
  const path = resolve(candidate.artifacts, 'utils.tgz');
  const original = await readFile(path);
  await writeFile(path, 'corrupt');
  assert.equal(candidate.run('validate-candidate', ['--artifact-dir', candidate.artifacts]).status, 1);
  await writeFile(path, original);
  const verify = candidate.run('verify-artifact', ['--artifact-dir', candidate.artifacts, '--require-validation']);
  assert.equal(verify.status, 1);
  assert.match(verify.stderr, /candidate-validation.json/);
});

const groups = ['source', 'tooling', 'documentation', 'distribution', 'browser', 'fixtures'];

async function grouped(t) {
  const candidate = await orchestrator(t);
  for (const group of groups) {
    const result = candidate.run('validate-candidate', ['--artifact-dir', candidate.artifacts, '--group', group]);
    assert.equal(result.status, 0, result.stderr);
  }
  return candidate;
}

test('independent lanes join the complete certificate without rerunning any checks or rebuilding', async t => {
  const candidate = await grouped(t);
  const before = await readFile(candidate.calls, 'utf8');
  const joined = candidate.run('validate-candidate', ['--artifact-dir', candidate.artifacts, '--join']);
  assert.equal(joined.status, 0, joined.stderr);
  assert.equal(await readFile(candidate.calls, 'utf8'), before);
  const calls = before.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(calls.length, 16);
  assert(!calls.some(call => ['build', 'release:artifact'].includes(call.args[1])));
  const verify = candidate.run('verify-artifact', ['--artifact-dir', candidate.artifacts, '--require-validation']);
  assert.equal(verify.status, 0, verify.stderr);
});

for (const mutation of ['missing', 'checksum', 'source', 'evidence', 'failed', 'duplicate', 'script', 'signal', 'log', 'attachment']) {
  test(`joining rejects ${mutation} lane evidence and revokes the old certificate`, async t => {
    const candidate = await grouped(t);
    await successfulValidation(candidate);
    const path = resolve(candidate.artifacts, 'candidate-validation-browser.json');
    const partial = JSON.parse(await readFile(path));
    if (mutation === 'missing') { await rm(path); } else {
      if (mutation === 'source') { partial.sourceCommit = 'a'.repeat(40); }
      if (mutation === 'evidence') { partial.evidenceSha512 = 'b'.repeat(128); }
      if (mutation === 'failed') { partial.status = 'failed'; }
      if (mutation === 'duplicate') { partial.checks.push(partial.checks[0]); }
      if (mutation === 'script') { partial.checks[0].script = 'build'; }
      if (mutation === 'signal') { partial.checks[0].signal = 'SIGTERM'; }
      if (mutation === 'attachment') { partial.attachments = []; }
      const text = JSON.stringify(partial);
      await writeFile(path, text);
      const { createHash } = await import('node:crypto');
      const checksum = createHash('sha512').update(text).digest('hex');
      await writeFile(resolve(candidate.artifacts, 'candidate-validation-browser.sha512'), `${mutation === 'checksum' ? 'wrong' : checksum}  candidate-validation-browser.json\n`);
      if (mutation === 'log') { await writeFile(resolve(candidate.artifacts, partial.checks[0].log.file), 'tampered'); }
    }
    const result = candidate.run('validate-candidate', ['--artifact-dir', candidate.artifacts, '--join']);
    assert.equal(result.status, 1, result.stdout);
    assert.equal(candidate.run('verify-artifact', ['--artifact-dir', candidate.artifacts, '--require-validation']).status, 1);
  });
}

test('failed lane retry revokes both its previous result and the complete certificate', async t => {
  const candidate = await grouped(t);
  await successfulValidation(candidate);
  await writeFile(candidate.npmCli, 'process.exit(3);');
  const result = candidate.run('validate-candidate', ['--artifact-dir', candidate.artifacts, '--group', 'browser']);
  assert.equal(result.status, 1);
  const partial = JSON.parse(await readFile(resolve(candidate.artifacts, 'candidate-validation-browser.json')));
  assert.equal(partial.status, 'failed');
  assert.equal(partial.checks[0].exitCode, 3);
  assert.equal(candidate.run('validate-candidate', ['--artifact-dir', candidate.artifacts, '--join']).status, 1);
});

for (const args of [['--group', 'unknown'], ['--group', 'source', '--join']]) {
  test(`candidate lane selection rejects ${args.join(' ')}`, async t => {
    const candidate = await orchestrator(t);
    const result = candidate.run('validate-candidate', ['--artifact-dir', candidate.artifacts, ...args]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Choose one known/);
    assert.equal(await readFile(candidate.calls, 'utf8'), '');
  });
}
