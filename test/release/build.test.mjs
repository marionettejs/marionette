import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { fixture, git, hash, names } from './fixture.mjs';

async function buildFixture(t, { version = '5.0.0-test.1', manifestMutation } = {}) {
  const candidate = await fixture(t);
  for (const [id, name] of names) {
    const directory = resolve(candidate.root, id === 'core' ? '.' : `packages/${id}`);
    await mkdir(directory, { recursive: true });
    const manifest = { name, version };
    if (['radio', 'core', 'data'].includes(id)) { manifest.dependencies = { '@mnjs/utils': version }; }
    if (id === 'core') { manifest.dependencies['@mnjs/radio'] = version; }
    if (id === 'adapters') { manifest.peerDependencies = { marionette: version }; }
    manifestMutation?.(id, manifest);
    await writeFile(resolve(directory, 'package.json'), JSON.stringify(manifest));
  }
  await writeFile(resolve(candidate.root, '.gitignore'), 'dist/\nnode_modules/\ntest/tmp/\n');
  await mkdir(resolve(candidate.root, 'scripts/performance'), { recursive: true });
  await writeFile(resolve(candidate.root, 'scripts/performance/bundle-size.mjs'), 'console.log(JSON.stringify({ fixture: \'bundle measured\' }));\n');
  git(candidate.root, ['add', '.']);
  git(candidate.root, ['-c', 'user.name=Release CLI tests', '-c', 'user.email=release-tests@example.invalid', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'build source']);
  const commit = git(candidate.root, ['rev-parse', 'HEAD']);
  const calls = resolve(candidate.directory, 'build-calls.jsonl');
  await writeFile(calls, '');
  await writeFile(candidate.npmCli, `
const { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { tmpdir } = require('node:os');
const { resolve, join } = require('node:path');
const assert = require('node:assert/strict');
const args = process.argv.slice(2);
appendFileSync(${JSON.stringify(calls)}, JSON.stringify(args) + '\\n');
if (args[0] === 'run') {
  if (process.env.RELEASE_TEST_BUILD_FAILURE === args[1]) { console.error('intentional build command failure'); process.exit(9); }
  if (args[1] === 'build') { mkdirSync('dist', { recursive: true }); writeFileSync('dist/built.js', 'built from source'); }
  else if (args[1] === 'test:dist') { assert.equal(readFileSync('dist/built.js', 'utf8'), 'built from source'); }
  else { throw new Error('Unexpected npm run: ' + args); }
  if (process.env.RELEASE_TEST_SOURCE_MUTATION) { writeFileSync('changed.js', 'changed during build'); }
  process.exit(0);
}
assert.equal(args[0], 'pack');
assert.deepEqual(args.slice(2, 5), ['--ignore-scripts', '--json', '--pack-destination']);
const manifest = JSON.parse(readFileSync(resolve(args[1], 'package.json')));
const filename = manifest.name.replace('@', '').replace('/', '-') + '.tgz';
const directory = mkdtempSync(join(tmpdir(), 'release-pack-fixture-'));
try {
  mkdirSync(join(directory, 'package'));
  cpSync(resolve(args[1], 'package.json'), join(directory, 'package/package.json'));
  writeFileSync(join(directory, 'package/built.js'), readFileSync('dist/built.js'));
  const result = spawnSync('tar', ['-czf', resolve(args[5], filename), '-C', directory, 'package']);
  assert.equal(result.status, 0);
} finally { rmSync(directory, { recursive: true, force: true }); }
const bytes = readFileSync(resolve(args[5], filename));
const report = { name: manifest.name, version: manifest.version, filename,
  integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64'), shasum: createHash('sha1').update(bytes).digest('hex') };
if (process.env.RELEASE_TEST_PACK_FAILURE === 'identity') { report.name = 'unexpected'; }
if (process.env.RELEASE_TEST_PACK_FAILURE === 'integrity') { report.integrity = 'sha512-invalid'; }
console.log(JSON.stringify(process.env.RELEASE_TEST_PACK_FAILURE === 'count' ? [] : [report]));
`);
  return { ...candidate, commit, calls, output: resolve(candidate.directory, 'built-artifact') };
}

for (const version of ['5.0.0-test.1', '5.0.0']) {
  test(`artifact construction packs and certifies all five packages for ${version}`, async t => {
    const candidate = await buildFixture(t, { version });
    const githubOutput = resolve(candidate.directory, 'github-output');
    const result = candidate.run('build-artifact', ['--output', candidate.output, '--source-commit', candidate.commit,
      '--source-ref', 'refs/heads/master'], { GITHUB_OUTPUT: githubOutput, GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '2' });
    assert.equal(result.status, 0, result.stderr);
    const evidenceBytes = await readFile(resolve(candidate.output, 'release-evidence.json'));
    const evidence = JSON.parse(evidenceBytes);
    assert.deepEqual(evidence.packages.map(entry => [entry.id, entry.name]), names);
    assert.equal(evidence.source.commit, candidate.commit);
    assert.deepEqual(evidence.release, { tag: `v${version}`, version, prerelease: version.includes('-'), npmTag: version.includes('-') ? 'next' : 'latest' });
    assert.equal(evidence.workflow.runId, '123');
    assert.equal(evidence.workflow.runAttempt, '2');
    assert.equal(await readFile(resolve(candidate.output, 'release-evidence.sha512'), 'utf8'), `${hash(evidenceBytes)}  release-evidence.json\n`);
    const files = await readdir(candidate.output);
    assert.equal(files.length, 13);
    for (const entry of evidence.packages) {
      assert.ok(files.includes(entry.tarball.file));
      assert.equal(entry.tarball.sha512, hash(await readFile(resolve(candidate.output, entry.tarball.file))));
      assert.match(await readFile(githubOutput, 'utf8'), new RegExp(`${entry.id}_tarball=${entry.tarball.file}`));
    }
    const calls = (await readFile(candidate.calls, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    assert.deepEqual(calls.slice(0, 2), [['run', 'build'], ['run', 'test:dist']]);
    assert.equal(calls.filter(args => args[0] === 'pack').length, 5);
    const verify = candidate.run('verify-artifact', ['--artifact-dir', candidate.output]);
    assert.equal(verify.status, 0, verify.stderr);
    const retry = candidate.run('build-artifact', ['--output', candidate.output]);
    assert.equal(retry.status, 1);
    assert.match(retry.stderr, /directory must be empty/);
  });
}

for (const [name, env, error] of [
  ['build failure', { RELEASE_TEST_BUILD_FAILURE: 'build' }, /status 9/],
  ['distribution failure', { RELEASE_TEST_BUILD_FAILURE: 'test:dist' }, /status 9/],
  ['pack count', { RELEASE_TEST_PACK_FAILURE: 'count' }, /Expected one utils tarball/],
  ['pack identity', { RELEASE_TEST_PACK_FAILURE: 'identity' }, /Unexpected packed utils/],
  ['pack integrity', { RELEASE_TEST_PACK_FAILURE: 'integrity' }, /integrity does not match/],
  ['source changed during build', { RELEASE_TEST_SOURCE_MUTATION: 'yes' }, /Checkout changed/],
]) {
  test(`artifact construction leaves no certifying evidence after ${name}`, async t => {
    const candidate = await buildFixture(t);
    const result = candidate.run('build-artifact', ['--output', candidate.output], env);
    assert.equal(result.status, 1);
    assert.match(result.stderr, error);
    await assert.rejects(readFile(resolve(candidate.output, 'release-evidence.json')), { code: 'ENOENT' });
  });
}

for (const [name, mutate, error] of [
  ['wrong package name', (id, manifest) => { if (id === 'utils') { manifest.name = 'other'; } }, /Unexpected utils/],
  ['version skew', (id, manifest) => { if (id === 'data') { manifest.version = '4.0.0'; } }, /does not match/],
  ['utils dependency skew', (id, manifest) => { if (id === 'radio') { delete manifest.dependencies; } }, /utils dependency missing/],
  ['Radio dependency skew', (id, manifest) => { if (id === 'core') { delete manifest.dependencies['@mnjs/radio']; } }, /Core Radio dependency missing/],
  ['adapter peer skew', (id, manifest) => { if (id === 'adapters') { delete manifest.peerDependencies; } }, /Marionette peer missing/],
]) {
  test(`artifact construction rejects ${name}`, async t => {
    const candidate = await buildFixture(t, { manifestMutation: mutate });
    const result = candidate.run('build-artifact', ['--output', candidate.output]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, error);
    await assert.rejects(readFile(resolve(candidate.output, 'release-evidence.json')), { code: 'ENOENT' });
  });
}

for (const [name, args, mutation, error] of [
  ['empty source ref', ['--source-commit', ''], false, /Empty argument --source-commit/],
  ['short source ref', ['--source-commit', 'abc'], false, /full 40-character/],
  ['wrong source commit', ['--source-commit', 'a'.repeat(40)], false, /does not match checked-out/],
  ['wrong repository', ['--repository', 'other/repository'], false, /does not match marionettejs/],
  ['dirty source checkout', [], true, /clean checkout/],
]) {
  test(`artifact construction rejects ${name} before invoking a build`, async t => {
    const candidate = await buildFixture(t);
    if (mutation) { await writeFile(resolve(candidate.root, 'dirty.js'), 'dirty'); }
    const result = candidate.run('build-artifact', ['--output', candidate.output, ...args]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, error);
    assert.equal(await readFile(candidate.calls, 'utf8'), '');
    await assert.rejects(readFile(resolve(candidate.output, 'release-evidence.json')), { code: 'ENOENT' });
  });
}


test('artifact construction rejects malformed publication policy before building packages', async t => {
  const candidate = await buildFixture(t);
  const policyPath = resolve(candidate.root, 'config/release-promotion.json');
  const policy = JSON.parse(await readFile(policyPath));
  policy.publication.prerelease = true;
  await writeFile(policyPath, JSON.stringify(policy));
  git(candidate.root, ['add', 'config/release-promotion.json']);
  git(candidate.root, ['-c', 'user.name=Release CLI tests', '-c', 'user.email=release-tests@example.invalid',
    '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'invalid policy']);
  const result = candidate.run('build-artifact', ['--output', candidate.output]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid release publication policy/);
  assert.equal(await readFile(candidate.calls, 'utf8'), '');
  assert.deepEqual(await readdir(candidate.output), []);
});
