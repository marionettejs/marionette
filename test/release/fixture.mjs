import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { copyCoverageFixture } from '../tooling/coverage-fixture.mjs';

const repository = resolve(import.meta.dirname, '../..');
const names = [
  ['utils', '@marionette/utils'], ['radio', '@marionette/radio'], ['core', 'marionette'],
  ['data', '@marionette/data'], ['adapters', '@marionette/adapters'],
];

function hash(value, algorithm = 'sha512', encoding = 'hex') {
  return createHash(algorithm).update(value).digest(encoding);
}

function git(root, args) {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

async function fixture(t, { publicationEnabled = false } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'marionette-release-cli-'));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const root = resolve(directory, 'source');
  const artifacts = resolve(directory, 'artifacts');
  await mkdir(root);
  await mkdir(artifacts);
  await copyCoverageFixture(resolve(repository, 'scripts/release'), resolve(root, 'scripts/release'));
  await cp(resolve(repository, 'config'), resolve(root, 'config'), { recursive: true });
  await cp(resolve(repository, 'package.json'), resolve(root, 'package.json'));
  await mkdir(resolve(root, 'test/fixtures/consumer'), { recursive: true });
  await writeFile(resolve(root, 'test/fixtures/consumer/package-lock.json'), '{}');
  const policyPath = resolve(root, 'config/release-promotion.json');
  const fixturePolicy = JSON.parse(await readFile(policyPath));
  fixturePolicy.publicationEnabled = publicationEnabled;
  await writeFile(policyPath, JSON.stringify(fixturePolicy));
  await writeFile(resolve(root, '.gitignore'), 'test/tmp/\n');
  git(root, ['init', '-q']);
  git(root, ['add', '.']);
  git(root, ['-c', 'user.name=Release CLI tests', '-c', 'user.email=release-tests@example.invalid',
    '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'test fixture']);
  const commit = git(root, ['rev-parse', 'HEAD']);
  const profileBytes = await readFile(resolve(root, 'config/release-profile.json'));
  const policyBytes = await readFile(resolve(root, 'config/release-promotion.json'));
  const profile = JSON.parse(profileBytes);
  const policy = JSON.parse(policyBytes);
  const npmDirectory = resolve(directory, 'npm');
  await mkdir(resolve(npmDirectory, 'bin'), { recursive: true });
  await writeFile(resolve(npmDirectory, 'package.json'), JSON.stringify({ version: profile.source.npm }));
  const npmCli = resolve(npmDirectory, 'bin/npm-cli.js');
  await writeFile(npmCli, 'throw new Error(\'This verification must not invoke npm or access a registry\');\n');
  const version = '5.0.0-test.1';
  const packages = [];
  for (const [id, name] of names) {
    const input = resolve(directory, id, 'package');
    await mkdir(input, { recursive: true });
    const manifest = { name, version };
    await writeFile(resolve(input, 'package.json'), JSON.stringify(manifest));
    const file = `${id}.tgz`;
    const packed = spawnSync('tar', ['-czf', resolve(artifacts, file), '-C', dirname(input), 'package'], { encoding: 'utf8' });
    assert.equal(packed.status, 0, packed.stderr);
    const bytes = await readFile(resolve(artifacts, file));
    const integrity = `sha512-${hash(bytes, 'sha512', 'base64')}`;
    const shasum = hash(bytes, 'sha1');
    const manifestReport = { name, version, filename: file, integrity, shasum };
    const manifestFile = `${id}-manifest.json`;
    const manifestText = JSON.stringify(manifestReport);
    await writeFile(resolve(artifacts, manifestFile), manifestText);
    packages.push({
      id, name, version, manifest,
      manifestReport: { file: manifestFile, sha512: hash(manifestText) },
      tarball: { file, size: bytes.length, sha256: hash(bytes, 'sha256'), sha512: hash(bytes), integrity, shasum },
    });
  }
  const bundle = '{}';
  await writeFile(resolve(artifacts, 'bundle.json'), bundle);
  const evidence = {
    schemaVersion: 2, packages,
    source: { commit, repository: 'marionettejs/marionette', ref: 'refs/heads/master' },
    release: { version, tag: `v${version}`, prerelease: true, npmTag: policy.npm.prereleaseTag },
    toolchain: { node: process.versions.node, npm: profile.source.npm },
    releaseProfile: { revision: git(root, ['rev-parse', 'HEAD:config/release-profile.json']), sha512: hash(profileBytes), profile },
    promotionPolicy: { revision: git(root, ['rev-parse', 'HEAD:config/release-promotion.json']), sha512: hash(policyBytes), publicationEnabled: policy.publicationEnabled },
    reports: { bundle: { file: 'bundle.json', sha512: hash(bundle) } },
  };
  async function save() {
    const text = JSON.stringify(evidence);
    await writeFile(resolve(artifacts, 'release-evidence.json'), text);
    await writeFile(resolve(artifacts, 'release-evidence.sha512'), `${hash(text)}  release-evidence.json\n`);
  }
  const preload = pathToFileURL(resolve(import.meta.dirname, 'fake-processes.mjs')).href;
  function run(script = 'verify-artifact', args = [], env = {}) {
    return spawnSync(process.execPath, [resolve(root, `scripts/release/${script}.mjs`), ...args], {
      cwd: root, encoding: 'utf8', timeout: 120000,
      env: { ...process.env, 'npm_execpath': npmCli, GH_TOKEN: '', GITHUB_TOKEN: '', GITHUB_SHA: '', GITHUB_REPOSITORY: '',
        NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import=${preload}`].filter(Boolean).join(' '), ...env },
    });
  }
  await save();
  return { directory, root, artifacts, evidence, save, run, commit, npmCli };
}

async function successfulValidation(candidate) {
  const checks = [
    ['profile', 'check:release-profile'], ['browser-profile', 'check:browser-profile'],
    ['diagnostics', 'check:diagnostics'], ['public-tests', 'check:public-tests'], ['workflows', 'check:workflows'],
    ['source-types', 'check:types'], ['consumer-types', 'test:types'], ['lint', 'lint:ci'],
    ['tooling', 'test:tooling'], ['source', 'test:source'], ['coverage', 'coverage'],
    ['documentation', 'docs:check'], ['distribution', 'test:dist'], ['browser', 'test:browser'],
    ['fixtures', 'test:fixtures'],
  ];
  const report = {
    schemaVersion: 1, sourceCommit: candidate.commit, status: 'passed',
    evidenceSha512: hash(await readFile(resolve(candidate.artifacts, 'release-evidence.json'))),
    checks: [], attachments: [],
  };
  for (const [id, script] of checks) {
    const file = `validation-${id}.log`;
    const text = `${script} passed\n`;
    await writeFile(resolve(candidate.artifacts, file), text);
    report.checks.push({ id, script, status: 'passed', exitCode: 0, log: { file, sha512: hash(text) } });
  }
  const reports = {
    'browser-candidate.json': { source: candidate.evidence.source, packages: candidate.evidence.packages },
    'browser-results.json': {
      errors: [], stats: { unexpected: 0, flaky: 0, skipped: 0, expected: 3 },
      suites: [{ specs: [{ tests: ['chromium', 'firefox', 'webkit'].map(projectName => ({
        projectName, status: 'expected', expectedStatus: 'passed', results: [{ status: 'passed' }],
      })) }] }],
    },
    'fixtures-report.json': {
      schemaVersion: 1, status: 'passed',
      artifacts: candidate.evidence.packages.map(entry => ({ name: entry.name, version: entry.version, sha256: entry.tarball.sha256 })),
      fixtures: [{ name: 'consumer', status: 'passed', stage: 'validate', lockSha256: hash('{}', 'sha256'),
        candidateLockSha256: hash('{}', 'sha256'), installedGraph: {} }],
    },
  };
  async function saveReport() {
    report.attachments = [];
    for (const [file, data] of Object.entries(reports)) {
      const text = JSON.stringify(data);
      await writeFile(resolve(candidate.artifacts, file), text);
      report.attachments.push({ file, sha512: hash(text) });
    }
    const text = JSON.stringify(report);
    await writeFile(resolve(candidate.artifacts, 'candidate-validation.json'), text);
    await writeFile(resolve(candidate.artifacts, 'candidate-validation.sha512'), `${hash(text)}  candidate-validation.json\n`);
  }
  await saveReport();
  return { report, reports, saveReport };
}

export { fixture, git, hash, names, successfulValidation };
