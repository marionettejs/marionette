import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { after, test } from 'node:test';
import { stringify, parse } from 'yaml';
import { checkPackages, rootCoveragePatterns } from '../../scripts/checks/packages.mjs';

const repository = resolve(import.meta.dirname, '../..');
const temporary = mkdtempSync(resolve(tmpdir(), 'mnjs-package-ownership-'));
after(() => rmSync(temporary, { recursive: true, force: true }));
const ownershipFile = 'config/package-ownership.json';
const htmlManifest = 'packages/html/package.json';
const workflowFile = '.github/workflows/html.yml';
// These authorities intentionally do not come from the ownership metadata under test.
const apiRoots = ['', 'packages/utils', 'packages/radio', 'packages/data', 'packages/adapters', 'packages/formkit'];
const coordinatedIds = ['utils', 'radio', 'core', 'data', 'adapters'];
const expectedCoverage = ['src/**/*.{js,ts}', 'packages/utils/src/**/*.ts', 'packages/radio/src/**/*.ts',
  'packages/data/src/**/*.ts', 'packages/adapters/src/**/*.ts', 'packages/formkit/src/**/*.ts',
  'packages/formkit/acceptance/experimental/composition-prototype.ts', 'packages/test/src/**/*.ts', 'packages/test/src/**/*.js'];
const read = (root, file) => readFileSync(resolve(root, file), 'utf8');
const json = (root, file) => JSON.parse(read(root, file));
function write(root, file, value) {
  const target = resolve(root, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value));
}
function edit(root, file, callback) { const value = json(root, file); callback(value); write(root, file, value); }
function entry(root, id, callback) { edit(root, ownershipFile, value => callback(value.packages.find(row => row.id === id))); }
function workflow(root, callback) { const value = parse(read(root, workflowFile)); callback(value); write(root, workflowFile, stringify(value)); }
const coverageStep = value => value.jobs.verify.steps.find(step => step.run === 'npm run coverage:html');
function fixture() {
  const root = mkdtempSync(resolve(temporary, 'case-'));
  const metadata = json(repository, ownershipFile);
  write(root, ownershipFile, metadata);
  write(root, 'package.json', json(repository, 'package.json'));
  write(root, 'config/release-profile.json', json(repository, 'config/release-profile.json'));
  for (const row of metadata.packages) {
    write(root, `${row.directory}/package.json`, json(repository, `${row.directory}/package.json`));
    write(root, `${row.directory}/${row.pipeline === 'html' ? 'LICENSE' : 'license.txt'}`, 'Fixture license authority.\n');
    // Shared checking resolves authority paths; it never executes package check bodies.
    for (const file of row.requiredInputs || []) {
      if (!existsSync(resolve(root, file))) { write(root, file, '// Package-owned authority fixture.\n'); }
    }
  }
  for (const file of ['scripts/checks/verify.mjs', workflowFile]) { write(root, file, read(repository, file)); }
  write(root, 'test/examples/verify-test-package.mjs', '// Packed helper authority fixture.\n');
  write(root, 'scripts/api-contracts/inventory.mjs', `export const packageRoots = ${JSON.stringify(apiRoots)};\n`);
  write(root, 'scripts/release/packages.mjs', `export const releasePackages = ${JSON.stringify(coordinatedIds.map(id => ({ id })))};\n`);
  return root;
}

test('accepts the untouched HTML ESM/development/LICENSE pipeline and retains exact root coverage', async() => {
  const root = fixture();
  const metadata = json(root, ownershipFile);
  assert.deepEqual(rootCoveragePatterns(metadata.packages), expectedCoverage);
  assert.equal(json(root, htmlManifest).exports['.'].import, undefined);
  assert.ok(json(root, htmlManifest).exports['.'].development);
  assert.ok(json(root, htmlManifest).files.includes('LICENSE'));
  const helper = metadata.packages.find(row => row.id === 'test');
  assert.equal(helper.stage, 'stable');
  assert.equal(helper.coordinatedRelease, false);
  assert.deepEqual(metadata.packages.filter(row => row.coordinatedRelease).map(row => row.id).sort(), [...coordinatedIds].sort());
  assert.deepEqual(await checkPackages(root), { packages: 8, coordinated: 5 });
});

test('the actual repository command reports metadata validation without claiming delegated execution', () => {
  const output = execFileSync(process.execPath, ['scripts/checks/packages.mjs'], { cwd: repository, encoding: 'utf8' });
  assert.match(output, /Verified 8 owned packages/);
  assert.match(output, /5 coordinated release targets remain unchanged/);
  assert.match(output, /Delegated checks were not executed/);
});

test('root declaration admission rejects HTML before touching its package-owned outputs', () => {
  const root = fixture();
  write(root, 'build/declarations.mjs', read(repository, 'build/declarations.mjs'));
  symlinkSync(resolve(repository, 'node_modules'), resolve(root, 'node_modules'), 'dir');
  const marker = 'packages/html/dist/types/esm/owned-marker';
  write(root, marker, 'Owned by the HTML pipeline.');
  const result = spawnSync(process.execPath, [resolve(root, 'build/declarations.mjs'), 'html'], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown declaration package: html/);
  assert.equal(read(root, marker), 'Owned by the HTML pipeline.');
});

const cases = [
  ['missing ownership row', root => edit(root, ownershipFile, value => value.packages.pop()), /Every package needs an ownership entry/],
  ['extra package directory', root => write(root, 'packages/extra/package.json', { name: '@mnjs/extra' }), /Every package needs an ownership entry/],
  ['duplicate id', root => entry(root, 'test', row => { row.id = 'formkit'; }), /Duplicate owned package id/],
  ['duplicate name', root => entry(root, 'test', row => { row.name = '@mnjs/formkit'; }), /Duplicate owned package name/],
  ['duplicate directory', root => entry(root, 'test', row => { row.directory = 'packages/formkit'; }), /Duplicate owned package directory/],
  ['wrong manifest name', root => edit(root, 'packages/data/package.json', value => { value.name = '@mnjs/wrong'; }), /Owned package identity mismatch/],
  ['wrong engine', root => edit(root, htmlManifest, value => { value.engines.node = '>=99'; }), /Consumer floor mismatch/],
  ['missing pipeline', root => entry(root, 'formkit', row => { delete row.pipeline; }), /Missing or unknown pipeline/],
  ['unknown pipeline', root => entry(root, 'html', row => { row.pipeline = 'skip'; }), /Missing or unknown pipeline/],
  ['root package moved into HTML', root => entry(root, 'formkit', row => { row.pipeline = 'html'; }), /Invalid HTML pipeline binding/],
  ['HTML moved into root', root => entry(root, 'html', row => { row.pipeline = 'root'; }), /Invalid root pipeline binding/],
  ['unknown root id', root => entry(root, 'formkit', row => { row.id = 'other'; }), /Invalid root pipeline binding/],
  ['redirected helper directory', root => {
    renameSync(resolve(root, 'packages/test'), resolve(root, 'packages/moved'));
    entry(root, 'test', row => { row.directory = 'packages/moved'; });
  }, /Invalid root directory/],
  ['wrong root metadata name', root => entry(root, 'test', row => { row.name = '@mnjs/other'; }), /Invalid root name/],
  ['changed root maturity', root => entry(root, 'formkit', row => { row.stage = 'stable'; }), /Invalid root stage/],
  ['stable helper mislabeled as development', root => entry(root, 'test', row => { row.stage = 'development'; }), /Invalid root stage/],
  ['HTML mislabeled as development', root => entry(root, 'html', row => { row.stage = 'development'; }), /Invalid HTML pipeline binding/],
  ['HTML mislabeled as testing', root => entry(root, 'html', row => { row.role = 'testing'; }), /Invalid HTML pipeline binding/],
  ['missing root coverage', root => entry(root, 'data', row => { row.coverage = []; }), /Root coverage changed/],
  ['missing FormKit prototype coverage', root => entry(root, 'formkit', row => { row.coverage.pop(); }), /Root coverage changed/],
  ['missing independent API member', root => write(root, 'scripts/api-contracts/inventory.mjs', `export const packageRoots = ${JSON.stringify(apiRoots.slice(0, -1))};`), /Root runtime API inventory/],
  ['missing release membership', root => entry(root, 'data', row => { delete row.coordinatedRelease; }), /Missing coordinated release membership/],
  ['changed coordinated membership', root => entry(root, 'formkit', row => { row.coordinatedRelease = true; }), /Coordinated release set changed/],
  ['stable helper added to coordinated release', root => entry(root, 'test', row => { row.coordinatedRelease = true; }), /Coordinated release set changed/],
  ['changed independent release authority', root => write(root, 'scripts/release/packages.mjs', `export const releasePackages = ${JSON.stringify([...coordinatedIds, 'html'].map(id => ({ id })))};`), /Coordinated release set changed/],
  ['missing exports', root => edit(root, 'packages/utils/package.json', value => { delete value.exports; }), /Missing artifact exports or content/],
  ['missing artifact content', root => edit(root, htmlManifest, value => { value.files = []; }), /Missing artifact exports or content/],
  ['missing root license', root => rmSync(resolve(root, 'packages/test/license.txt')), /Missing package license/],
  ['invalid helper role', root => entry(root, 'test', row => { row.role = 'other'; }), /Invalid package role/],
  ['missing root build command', root => edit(root, 'package.json', value => { delete value.scripts['build:formkit']; }), /Missing build command/],
  ['root build omits FormKit', root => edit(root, 'package.json', value => { value.scripts.build = value.scripts.build.replace('npm run build:formkit && ', ''); }), /Normal build omits formkit/],
  ['deleted FormKit artifact metadata', root => entry(root, 'formkit', row => { delete row.verificationScript; }), /Missing artifact verification/],
  ['deleted helper artifact metadata', root => entry(root, 'test', row => { delete row.verificationScript; }), /Missing artifact verification/],
  ['wrong helper artifact command', root => edit(root, 'package.json', value => { value.scripts['test:helpers:consumer'] = 'echo passed'; }), /Wrong artifact command/],
  ['missing packed FormKit input', root => rmSync(resolve(root, 'test/fixtures/formkit-package/verify.mjs')), /Missing owned verification input/],
  ['missing packed helper input', root => rmSync(resolve(root, 'test/examples/verify-test-package.mjs')), /Missing artifact input/],
  ['FormKit verification only in a comment', root => write(root, 'scripts/checks/verify.mjs', read(root, 'scripts/checks/verify.mjs').replace('\'test:formkit-package\',', '') + '\n// \'test:formkit-package\'\n'), /Normal verification omits artifact consumption/],
  ['helper verification removed', root => write(root, 'scripts/checks/verify.mjs', read(root, 'scripts/checks/verify.mjs').replace('\'test:helpers:consumer\',', '')), /Normal verification omits artifact consumption/],
  ['missing verification array', root => write(root, 'scripts/checks/verify.mjs', '// No executable verification array.\n'), /Normal verification omits artifact consumption/],
  ['uninitialized verification array', root => write(root, 'scripts/checks/verify.mjs', 'let scripts;\n'), /Normal verification omits artifact consumption/],
  ['extra root verification without command', root => entry(root, 'data', row => { row.verificationScript = 'missing-check'; }), /Missing artifact verification/],
  ['unknown ownership schema', root => edit(root, ownershipFile, value => { value.schemaVersion = 2; }), /Unsupported package ownership schema/],
  ['deleted HTML delegation field', root => entry(root, 'html', row => { delete row.coverageScript; }), /Missing or wrong HTML delegation/],
  ['wrong HTML delegation field', root => entry(root, 'html', row => { row.workflow = 'some-other.yml'; }), /Missing or wrong HTML delegation/],
  ['deleted HTML authorities metadata', root => entry(root, 'html', row => { delete row.requiredInputs; }), /Missing HTML authority metadata/],
  ['HTML coverage smuggled into root', root => entry(root, 'html', row => { row.coverage = ['packages/html/src/**/*.ts']; }), /HTML coverage belongs to its package pipeline/],
  ['wrong HTML license', root => edit(root, htmlManifest, value => { value.license = 'MIT'; }), /HTML license identity changed/],
  ['missing HTML license', root => rmSync(resolve(root, 'packages/html/LICENSE')), /Missing package license/],
  ['unpacked HTML notices', root => edit(root, htmlManifest, value => { value.files = value.files.filter(file => file !== 'THIRD_PARTY_NOTICES.md'); }), /Missing HTML packaged authority/],
  ['wrong delegated prefix', root => edit(root, 'package.json', value => { value.scripts['build:html'] = 'npm --prefix packages/formkit run build'; }), /Wrong HTML root command/],
  ['placeholder delegated command', root => edit(root, 'package.json', value => { value.scripts['test:html'] = 'echo npm --prefix packages/html run check'; }), /Wrong HTML root command/],
  ['ignored delegated failure', root => edit(root, 'package.json', value => { value.scripts['coverage:html'] += ' || true'; }), /Wrong HTML root command/],
  ['package check loses types', root => edit(root, htmlManifest, value => { value.scripts.check = value.scripts.check.replace('npm run check:types && ', ''); }), /Wrong HTML package command/],
  ['no-op package types', root => edit(root, htmlManifest, value => { value.scripts['check:types'] = 'true'; }), /Wrong HTML package command/],
  ['no-op package browser authority', root => edit(root, htmlManifest, value => { value.scripts['test:packed:browser'] = 'echo passed'; }), /Wrong HTML package command/],
  ['missing workflow', root => rmSync(resolve(root, workflowFile)), /Missing HTML workflow authority/],
  ['invalid workflow YAML', root => write(root, workflowFile, 'jobs: {}\njobs: {}\n'), /Invalid HTML workflow YAML/],
  ['manual-only HTML workflow triggers', root => workflow(root, value => { value.on = { 'workflow_dispatch': {} }; }), /Missing automatic HTML workflow triggers/],
  ['missing HTML pull-request trigger', root => workflow(root, value => { delete value.on.pull_request; }), /Missing automatic HTML workflow triggers/],
  ['redirected HTML push branch', root => workflow(root, value => { value.on.push.branches = ['other']; }), /HTML workflow master-push trigger changed/],
  ['missing workflow job', root => workflow(root, value => { delete value.jobs.verify; }), /Missing HTML verification job/],
  ['skipped prerequisite for HTML verification', root => workflow(root, value => {
    value.jobs.prepare = { 'runs-on': 'ubuntu-24.04', if: false, steps: [{ run: 'true' }] };
    value.jobs.verify.needs = 'prepare';
  }), /HTML verification job has an unreviewed prerequisite/],
  ['ignored workflow job', root => workflow(root, value => { value.jobs.verify['continue-on-error'] = true; }), /HTML verification job can be ignored/],
  ['skipped workflow job', root => workflow(root, value => { value.jobs.verify.if = false; }), /HTML verification job can be ignored/],
  ['workflow shell override', root => workflow(root, value => { value.defaults = { run: { shell: 'bash {0}' } }; }), /overrides required command execution/],
  ['workflow working-directory override', root => workflow(root, value => { value.jobs.verify.defaults = { run: { 'working-directory': 'packages/html' } }; }), /overrides required command execution/],
  ['HTML lock validation after package installation', root => workflow(root, value => {
    const steps = value.jobs.verify.steps;
    const index = steps.findIndex(step => step.run === 'node packages/html/scripts/check-lockfile.mjs');
    steps.push(...steps.splice(index, 1));
  }), /HTML lockfile validation must precede package installation/],
  ['gate removed but named in comment', root => {
    workflow(root, value => { value.jobs.verify.steps = value.jobs.verify.steps.filter(step => step.run !== 'npm run coverage:html'); });
    write(root, workflowFile, read(root, workflowFile) + '\n# npm run coverage:html\n');
  }, /Missing HTML workflow command/],
  ['no-op workflow gate', root => workflow(root, value => { coverageStep(value).run = 'echo npm run coverage:html'; }), /Missing HTML workflow command/],
  ['ignored gate command failure', root => workflow(root, value => { coverageStep(value).run += ' || true'; }), /Missing HTML workflow command/],
  ['ignored workflow step', root => workflow(root, value => { coverageStep(value)['continue-on-error'] = true; }), /can be ignored or redirected/],
  ['skipped workflow step', root => workflow(root, value => { coverageStep(value).if = false; }), /can be ignored or redirected/],
  ['redirected workflow step', root => workflow(root, value => { coverageStep(value)['working-directory'] = 'packages/html'; }), /can be ignored or redirected/],
  ['step shell swallows failures', root => workflow(root, value => { coverageStep(value).shell = 'bash {0}'; }), /can be ignored or redirected/]
];
for (const file of ['THIRD_PARTY_NOTICES.md', 'PROVENANCE.md', 'RELEASE.md', 'coverage.json', 'coverage-baseline.json',
  'scripts/check-coverage.mjs', 'scripts/check-package.mjs', 'scripts/check-current-core.mjs', 'scripts/check-packed-browser.mjs', 'test/packed-runtime.mjs']) {
  cases.push([`missing HTML authority ${file}`, root => rmSync(resolve(root, `packages/html/${file}`)), /Missing owned verification input/]);
}
for (const field of ['buildScript', 'verificationScript', 'workflow', 'licenseFile']) {
  cases.push([`deleted HTML delegation ${field}`, root => entry(root, 'html', row => { delete row[field]; }), /Missing or wrong HTML delegation/]);
}
cases.push(['deleted packed-consumer authority metadata', root => entry(root, 'html', row => {
  row.requiredInputs = row.requiredInputs.filter(file => file !== 'packages/html/test/packed-runtime.mjs');
}), /Missing HTML authority metadata/]);
for (const command of ['node packages/html/scripts/check-lockfile.mjs', 'npm --prefix packages/html ci --ignore-scripts',
  'npm run lint:html', 'npm run test:html', 'npm run coverage:html', 'npm run test:html:current-core',
  'npm --prefix packages/html run test:packed:browser']) {
  cases.push([`missing actual gate ${command}`, root => {
    workflow(root, value => { value.jobs.verify.steps = value.jobs.verify.steps.filter(step => step.run !== command); });
    write(root, workflowFile, read(root, workflowFile) + `\n# ${command}\n`);
  }, /Missing HTML workflow command/]);
}
for (const [name, mutate, expected] of cases) {
  test(`rejects ${name}`, async() => {
    const root = fixture();
    mutate(root);
    await assert.rejects(checkPackages(root), expected);
  });
}

test('the coverage consumer also rejects unknown or missing selectors before omitting any root source', () => {
  for (const value of [undefined, 'unverified']) {
    const metadata = json(repository, ownershipFile);
    metadata.packages.find(row => row.id === 'formkit').pipeline = value;
    assert.throws(() => rootCoveragePatterns(metadata.packages), /Missing or unknown pipeline/);
  }
});
