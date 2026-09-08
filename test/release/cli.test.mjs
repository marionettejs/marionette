import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { fixture, names, successfulValidation } from './fixture.mjs';

test('the artifact CLI accepts real packed packages tied to the checked-out source', async t => {
  const candidate = await fixture(t);
  const result = candidate.run('verify-artifact', ['--artifact-dir', candidate.artifacts,
    '--source-commit', candidate.commit, '--repository', 'marionettejs/marionette']);
  assert.equal(result.status, 0, result.stderr);
  for (const [id] of names) { assert.match(result.stdout, new RegExp(`Verified ${id}\\.tgz`)); }
});

const mutations = [
  ['wrong source', evidence => { evidence.source.commit = 'a'.repeat(40); }, /source commit mismatch/],
  ['wrong package version', evidence => { evidence.packages[2].version = '9.0.0'; }, /manifest version mismatch/],
  ['wrong package identity', evidence => { evidence.packages[0].name = 'unexpected'; }, /package name mismatch/],
  ['missing package', evidence => { evidence.packages.pop(); }, /package order/],
  ['wrong package order', evidence => { evidence.packages.reverse(); }, /package order/],
  ['wrong tarball size', evidence => { evidence.packages[0].tarball.size++; }, /tarball size mismatch/],
  ['wrong tarball digest', evidence => { evidence.packages[0].tarball.sha256 = 'a'; }, /SHA-256 mismatch/],
  ['wrong npm integrity', evidence => { evidence.packages[0].tarball.integrity = 'a'; }, /npm integrity mismatch/],
  ['changed manifest', evidence => { evidence.packages[0].manifest.name = 'changed'; }, /packed package.json/],
  ['escaping tarball', evidence => { evidence.packages[0].tarball.file = '../utils.tgz'; }, /contained file name/],
  ['drive-relative tarball', evidence => { evidence.packages[0].tarball.file = 'C:utils.tgz'; }, /contained file name/],
  ['wrong bundle digest', evidence => { evidence.reports.bundle.sha512 = 'a'; }, /bundle report SHA-512 mismatch/],
  ['changed embedded profile', evidence => { evidence.releaseProfile.profile.browsers.playwright.browserBuilds.pop(); }, /embedded release profile mismatch/],
  ['wrong profile digest', evidence => { evidence.releaseProfile.sha512 = 'a'; }, /release profile SHA-512 mismatch/],
  ['wrong policy digest', evidence => { evidence.promotionPolicy.sha512 = 'a'; }, /promotion policy SHA-512 mismatch/],
  ['wrong toolchain', evidence => { evidence.toolchain.node = '1.0.0'; }, /Node version mismatch/],
  ['wrong tag', evidence => { evidence.release.tag = 'v9.0.0'; }, /release tag mismatch/],
  ['wrong dist-tag', evidence => { evidence.release.npmTag = 'latest'; }, /npm dist-tag mismatch/],
];

for (const [name, mutate, expected] of mutations) {
  test(`artifact verification rejects ${name} even with a recomputed evidence checksum`, async t => {
    const candidate = await fixture(t);
    mutate(candidate.evidence);
    await candidate.save();
    const result = candidate.run('verify-artifact', ['--artifact-dir', candidate.artifacts]);
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, expected);
  });
}

test('changed tarball bytes and evidence bytes cannot retain their old checksums', async t => {
  const candidate = await fixture(t);
  await writeFile(resolve(candidate.artifacts, 'utils.tgz'), 'corrupted');
  let result = candidate.run('verify-artifact', ['--artifact-dir', candidate.artifacts]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /tarball size mismatch/);
  await writeFile(resolve(candidate.artifacts, 'release-evidence.json'), JSON.stringify({ ...candidate.evidence, extra: true }));
  result = candidate.run('verify-artifact', ['--artifact-dir', candidate.artifacts]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /evidence checksum mismatch/);
});

test('candidate promotion requires its successful validation report', async t => {
  const candidate = await fixture(t);
  const result = candidate.run('verify-artifact', ['--artifact-dir', candidate.artifacts, '--require-validation']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /candidate-validation.json/);
});

test('release CLIs reject unknown, duplicate and incomplete arguments before actions', async t => {
  const candidate = await fixture(t);
  for (const script of ['verify-artifact', 'build-artifact', 'check-targets', 'publish-github', 'validate-candidate']) {
    for (const args of [['--unknown'], ['--artifact-dir'], ['--artifact-dir', 'a', '--artifact-dir', 'b']]) {
      const result = candidate.run(script, args);
      assert.equal(result.status, 1, `${script}: ${args}`);
      assert.match(result.stderr, /Unknown option|requires an argument|argument missing|Duplicate argument/);
    }
  }
});

test('publication preflight defaults to dry-run and rejects unauthorized modes and identities', async t => {
  const candidate = await fixture(t);
  const safe = candidate.run('preflight');
  assert.equal(safe.status, 0, safe.stderr);
  assert.match(safe.stdout, /dry-run/);
  for (const args of [
    ['--mode', 'publish'], ['--mode', 'unknown'], ['--repository', 'other/repository'],
    ['--mode', 'dry-run', '--mode', 'publish'], ['--unknown', 'value'], ['--mode'],
  ]) {
    const result = candidate.run('preflight', args);
    assert.equal(result.status, 1, args.join(' '));
    assert.match(result.stderr, /Release promotion preflight failed/);
  }
});

test('promotion verifies complete browser and fixture evidence for the exact candidate', async t => {
  const candidate = await fixture(t);
  await successfulValidation(candidate);
  const result = candidate.run('verify-artifact', ['--artifact-dir', candidate.artifacts, '--require-validation']);
  assert.equal(result.status, 0, result.stderr);
  const plan = candidate.run('publish-github', ['--artifact-dir', candidate.artifacts]);
  assert.equal(plan.status, 0, plan.stderr);
  const assets = JSON.parse(plan.stdout).assets;
  assert.ok(assets.includes('candidate-validation.json'));
  assert.ok(assets.includes('browser-results.json'));
  assert.ok(assets.includes('fixtures-report.json'));
});

for (const [name, mutate, expected] of [
  ['failed check', ({ report }) => { report.checks[0].exitCode = 1; }, /successful required check/],
  ['omitted check', ({ report }) => { report.checks.pop(); }, /successful required check/],
  ['different evidence', ({ report }) => { report.evidenceSha512 = 'other'; }, /does not certify/],
  ['partial report', ({ report }) => { report.status = 'running'; }, /does not certify/],
  ['changed browser artifact', ({ reports }) => { reports['browser-candidate.json'].packages[0].tarball.sha512 = 'other'; }, /different candidate artifacts/],
  ['missing engine', ({ reports }) => { reports['browser-results.json'].suites[0].specs[0].tests.pop(); }, /every case/],
  ['omitted browser error evidence', ({ reports }) => { delete reports['browser-results.json'].errors; }, /every case/],
  ['invalid browser error evidence', ({ reports }) => { reports['browser-results.json'].errors = {}; }, /every case/],
  ['omitted browser contract with matching counts', ({ reports }) => {
    reports['browser-results.json'].suites[0].specs.pop();
    reports['browser-results.json'].stats.expected = 3;
  }, /every case/],
  ['duplicate browser contract', ({ reports }) => {
    reports['browser-results.json'].suites[0].specs[1] = reports['browser-results.json'].suites[0].specs[0];
  }, /every case/],
  ['skipped browser case', ({ reports }) => { reports['browser-results.json'].stats.skipped = 1; }, /every case/],
  ['expected browser failure', ({ reports }) => { reports['browser-results.json'].suites[0].specs[0].tests[0].expectedStatus = 'failed'; }, /every case/],
  ['different fixture artifact', ({ reports }) => { reports['fixtures-report.json'].artifacts[0].sha256 = 'other'; }, /every locked consumer/],
  ['missing fixture', ({ reports }) => { reports['fixtures-report.json'].fixtures = []; }, /every locked consumer/],
  ['changed lock', ({ reports }) => { reports['fixtures-report.json'].fixtures[0].lockSha256 = 'other'; }, /Fixture lock changed/],
  ['escaping log', ({ report }) => { report.checks[0].log.file = '../outside.log'; }, /contained file name/],
]) {
  test(`promotion rejects ${name} with recomputed report checksums`, async t => {
    const candidate = await fixture(t);
    const validation = await successfulValidation(candidate);
    mutate(validation);
    await validation.saveReport();
    const result = candidate.run('verify-artifact', ['--artifact-dir', candidate.artifacts, '--require-validation']);
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, expected);
  });
}

test('candidate failure records the command output and cannot retain an earlier success', async t => {
  const candidate = await fixture(t);
  await successfulValidation(candidate);
  await writeFile(candidate.npmCli, 'console.error(\'intentional candidate command failure\'); process.exit(7);\n');
  const result = candidate.run('validate-candidate', ['--artifact-dir', candidate.artifacts]);
  assert.equal(result.status, 1, result.stdout);
  const report = JSON.parse(await readFile(resolve(candidate.artifacts, 'candidate-validation.json')));
  assert.equal(report.status, 'failed');
  assert.equal(report.checks.length, 1);
  assert.equal(report.checks[0].exitCode, 7);
  assert.match(await readFile(resolve(candidate.artifacts, report.checks[0].log.file), 'utf8'), /intentional candidate command failure/);
  const verify = candidate.run('verify-artifact', ['--artifact-dir', candidate.artifacts, '--require-validation']);
  assert.equal(verify.status, 1);
  assert.match(verify.stderr, /does not certify/);
});

test('candidate validation rejects uncommitted source changes before any check runs', async t => {
  const candidate = await fixture(t);
  await writeFile(resolve(candidate.root, 'uncommitted.js'), 'changed');
  const result = candidate.run('validate-candidate', ['--artifact-dir', candidate.artifacts]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /clean source checkout/);
});

for (const name of ['../outside', '/absolute', 'C:outside']) {
  test(`candidate validation rejects noncanonical package name ${name} before any check or extraction`, async t => {
    const candidate = await fixture(t);
    candidate.evidence.packages[0].name = name;
    await candidate.save();
    const result = candidate.run('validate-candidate', ['--artifact-dir', candidate.artifacts]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /utils package name mismatch/);
    assert.doesNotMatch(result.stdout, /Candidate check/);
    await assert.rejects(readFile(resolve(candidate.artifacts, 'candidate-validation.json')), { code: 'ENOENT' });
  });
}

test('removing a consumer directory and its result cannot reduce the required fixture inventory', async t => {
  const candidate = await fixture(t);
  const validation = await successfulValidation(candidate);
  await rm(resolve(candidate.root, 'test/fixtures/consumer'), { recursive: true });
  validation.reports['fixtures-report.json'].fixtures = [];
  await validation.saveReport();
  const result = candidate.run('verify-artifact', ['--artifact-dir', candidate.artifacts, '--require-validation']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /every locked consumer/);
});
