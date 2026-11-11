import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseDocument } from 'yaml';

const rootCoverage = {
  core: ['src/**/*.{js,ts}'],
  utils: ['packages/utils/src/**/*.ts'],
  radio: ['packages/radio/src/**/*.ts'],
  data: ['packages/data/src/**/*.ts'],
  adapters: ['packages/adapters/src/**/*.ts'],
  formkit: ['packages/formkit/src/**/*.ts', 'packages/formkit/acceptance/experimental/composition-prototype.ts'],
  test: ['packages/test/src/**/*.ts', 'packages/test/src/**/*.js']
};
const artifacts = {
  formkit: { script: 'test:formkit-package', command: 'node test/fixtures/formkit-package/run.mjs',
    inputs: ['test/fixtures/formkit-package/run.mjs', 'test/fixtures/formkit-package/verify.mjs'] },
  test: { script: 'test:helpers:consumer', command: 'node test/examples/verify-test-package.mjs',
    inputs: ['test/examples/verify-test-package.mjs'] }
};
const htmlInputs = ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'PROVENANCE.md', 'RELEASE.md',
  'coverage.json', 'coverage-baseline.json', 'scripts/check-coverage.mjs', 'scripts/check-package.mjs',
  'scripts/check-current-core.mjs', 'scripts/check-packed-browser.mjs', 'scripts/check-lockfile.mjs',
  'scripts/check-upstream.mjs', 'scripts/build-production.mjs', 'test/packed-runtime.mjs',
  'tsconfig.json', 'test/tsconfig.json'];
const htmlRootCommands = {
  'build:html': 'npm --prefix packages/html run build',
  'test:html': 'npm --prefix packages/html run check',
  'lint:html': 'eslint --config packages/html/eslint.config.mjs packages/html/src packages/html/scripts packages/html/test --max-warnings=0',
  'coverage:html': 'npm --prefix packages/html run build && cd packages/html && node ../../node_modules/c8/bin/c8.js --config coverage.json node --conditions=development --test --test-concurrency=1 test/*.test.mjs && node scripts/check-coverage.mjs',
  'test:html:current-core': 'npm run build && npm --prefix packages/html run build && cd packages/html && node scripts/check-current-core.mjs'
};
const htmlPackageCommands = {
  build: 'tsc -p tsconfig.json && node scripts/build-production.mjs',
  check: 'node scripts/check-lockfile.mjs && npm run check:upstream && npm run build && npm test && npm run test:development && npm run check:types && node scripts/check-package.mjs',
  'check:types': 'tsc -p test/tsconfig.json',
  'check:upstream': 'node scripts/check-upstream.mjs',
  test: 'node --test --test-concurrency=1 test/*.test.mjs',
  'test:development': 'node --conditions=development --test --test-concurrency=1 test/*.test.mjs',
  'test:packed:browser': 'node scripts/check-packed-browser.mjs'
};
const htmlWorkflowCommands = ['node packages/html/scripts/check-lockfile.mjs',
  'npm --prefix packages/html ci --ignore-scripts', 'npm run lint:html', 'npm run test:html',
  'npm run coverage:html', 'npm run test:html:current-core', 'npm --prefix packages/html run test:packed:browser'];

function pipeline(entry) {
  assert(['root', 'html'].includes(entry.pipeline), `Missing or unknown pipeline: ${entry.id}`);
  if (entry.pipeline === 'html') {
    assert.deepEqual([entry.id, entry.name, entry.directory, entry.role, entry.stage, entry.coordinatedRelease],
      ['html', '@mnjs/html', 'packages/html', 'runtime', 'release-candidate', false], 'Invalid HTML pipeline binding');
  } else {
    assert(Object.hasOwn(rootCoverage, entry.id), `Invalid root pipeline binding: ${entry.id}`);
    assert.equal(entry.directory, entry.id === 'core' ? '.' : `packages/${entry.id}`, `Invalid root directory: ${entry.id}`);
    assert.equal(entry.name, entry.id === 'core' ? 'marionette' : `@mnjs/${entry.id}`, `Invalid root name: ${entry.id}`);
    assert.equal(entry.stage, entry.id === 'formkit' ? 'development' : 'stable', `Invalid root stage: ${entry.id}`);
  }
}

export function rootCoveragePatterns(entries) {
  entries.forEach(pipeline);
  const roots = entries.filter(entry => entry.pipeline === 'root');
  assert.deepEqual(roots.map(entry => entry.id).sort(), Object.keys(rootCoverage).sort(), 'Root coverage package set changed');
  for (const entry of roots) { assert.deepEqual(entry.coverage, rootCoverage[entry.id], `Root coverage changed: ${entry.id}`); }
  return roots.flatMap(entry => entry.coverage);
}

function htmlPipeline(entry, pkg, manifest, root) {
  for (const [field, expected] of Object.entries({ buildScript: 'build:html', verificationScript: 'test:html',
    coverageScript: 'coverage:html', workflow: '.github/workflows/html.yml', licenseFile: 'LICENSE' })) {
    assert.equal(entry[field], expected, `Missing or wrong HTML delegation: ${field}`);
  }
  assert.deepEqual(entry.coverage, [], 'HTML coverage belongs to its package pipeline');
  for (const input of htmlInputs) {
    assert(entry.requiredInputs?.includes(`packages/html/${input}`), `Missing HTML authority metadata: ${input}`);
  }
  assert.equal(pkg.license, 'BSD-3-Clause AND MIT', 'HTML license identity changed');
  for (const file of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'PROVENANCE.md', 'RELEASE.md']) {
    assert(pkg.files.includes(file), `Missing HTML packaged authority: ${file}`);
  }
  for (const [script, command] of Object.entries(htmlRootCommands)) {
    assert.equal(manifest.scripts[script], command, `Wrong HTML root command: ${script}`);
  }
  for (const [script, command] of Object.entries(htmlPackageCommands)) {
    assert.equal(pkg.scripts[script], command, `Wrong HTML package command: ${script}`);
  }
  assert(existsSync(resolve(root, entry.workflow)), 'Missing HTML workflow authority');
  const document = parseDocument(readFileSync(resolve(root, entry.workflow), 'utf8'), { uniqueKeys: true });
  assert.deepEqual(document.errors, [], 'Invalid HTML workflow YAML');
  const workflow = document.toJS();
  assert(workflow.on?.pull_request && workflow.on?.push, 'Missing automatic HTML workflow triggers');
  assert.deepEqual(workflow.on.push.branches, ['master'], 'HTML workflow master-push trigger changed');
  const job = workflow.jobs?.verify;
  assert(job && Array.isArray(job.steps), 'Missing HTML verification job');
  assert(!job['continue-on-error'] && job.if === undefined, 'HTML verification job can be ignored');
  assert.equal(job.needs, undefined, 'HTML verification job has an unreviewed prerequisite');
  for (const defaults of [workflow.defaults, job.defaults]) {
    assert(!defaults?.run?.shell && !defaults?.run?.['working-directory'], 'HTML workflow overrides required command execution');
  }
  for (const command of htmlWorkflowCommands) {
    const steps = job.steps.filter(step => step.run?.trim() === command);
    assert(steps.length, `Missing HTML workflow command: ${command}`);
    for (const step of steps) {
      assert(!step['continue-on-error'] && step.if === undefined && !step.shell && !step['working-directory'],
        `HTML workflow command can be ignored or redirected: ${command}`);
    }
  }
  const lock = job.steps.findIndex(step => step.run?.trim() === htmlWorkflowCommands[0]);
  const install = job.steps.findIndex(step => step.run?.trim() === htmlWorkflowCommands[1]);
  assert(lock < install, 'HTML lockfile validation must precede package installation');
}

export async function checkPackages(root) {
  const read = file => JSON.parse(readFileSync(resolve(root, file), 'utf8'));
  const inventory = read('config/package-ownership.json');
  const manifest = read('package.json');
  const profile = read('config/release-profile.json');
  assert.equal(inventory.schemaVersion, 1, 'Unsupported package ownership schema');
  const entries = inventory.packages;
  for (const field of ['id', 'name', 'directory']) {
    assert.equal(new Set(entries.map(entry => entry[field])).size, entries.length, `Duplicate owned package ${field}`);
  }
  const actual = ['.', ...readdirSync(resolve(root, 'packages')).filter(name =>
    existsSync(resolve(root, 'packages', name, 'package.json'))).map(name => `packages/${name}`)].sort();
  assert.deepEqual(entries.map(entry => entry.directory).sort(), actual, 'Every package needs an ownership entry');
  rootCoveragePatterns(entries);
  const [{ releasePackages }, { packageRoots }, { default: ts }] = await Promise.all([
    import(pathToFileURL(resolve(root, 'scripts/release/packages.mjs'))),
    import(pathToFileURL(resolve(root, 'scripts/api-contracts/inventory.mjs'))), import('typescript')
  ]);
  assert.deepEqual(packageRoots.map(path => path || '.').sort(),
    entries.filter(entry => entry.pipeline === 'root' && entry.role === 'runtime').map(entry => entry.directory).sort(),
    'Root runtime API inventory must include every root runtime package');
  assert(entries.every(entry => typeof entry.coordinatedRelease === 'boolean'), 'Missing coordinated release membership');
  assert.deepEqual(entries.filter(entry => entry.coordinatedRelease).map(entry => entry.id).sort(),
    releasePackages.map(entry => entry.id).sort(), 'Coordinated release set changed');
  const source = ts.createSourceFile('verify.mjs', readFileSync(resolve(root, 'scripts/checks/verify.mjs'), 'utf8'), ts.ScriptTarget.Latest, true);
  const verification = source.statements.filter(ts.isVariableStatement).flatMap(statement => statement.declarationList.declarations)
    .find(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === 'scripts');
  const verificationScripts = verification?.initializer && ts.isArrayLiteralExpression(verification.initializer) ?
    verification.initializer.elements.filter(ts.isStringLiteral).map(element => element.text) : [];
  for (const entry of entries) {
    assert(['runtime', 'testing'].includes(entry.role), `Invalid package role: ${entry.id}`);
    const pkg = read(`${entry.directory}/package.json`);
    assert.equal(pkg.name, entry.name, `Owned package identity mismatch: ${entry.id}`);
    assert.equal(pkg.engines?.node, profile.source.consumerNodeRange, `Consumer floor mismatch: ${entry.id}`);
    const license = entry.pipeline === 'html' ? 'LICENSE' : 'license.txt';
    assert(existsSync(resolve(root, entry.directory, license)), `Missing package license: ${entry.id}`);
    assert(pkg.exports && pkg.files?.length, `Missing artifact exports or content: ${entry.id}`);
    for (const input of entry.requiredInputs || []) {
      assert(existsSync(resolve(root, input)), `Missing owned verification input for ${entry.id}: ${input}`);
    }
    if (entry.pipeline === 'html') { htmlPipeline(entry, pkg, manifest, root); continue; }
    assert(manifest.scripts[entry.buildScript], `Missing build command: ${entry.id}`);
    assert(manifest.scripts.build.split(' && ').includes(`npm run ${entry.buildScript}`), `Normal build omits ${entry.id}`);
    if (artifacts[entry.id]) {
      const artifact = artifacts[entry.id];
      assert.equal(entry.verificationScript, artifact.script, `Missing artifact verification: ${entry.id}`);
      assert.equal(manifest.scripts[artifact.script], artifact.command, `Wrong artifact command: ${entry.id}`);
      for (const input of artifact.inputs) { assert(existsSync(resolve(root, input)), `Missing artifact input: ${input}`); }
    }
    if (entry.verificationScript) {
      assert(manifest.scripts[entry.verificationScript], `Missing artifact verification: ${entry.id}`);
      assert(verificationScripts.includes(entry.verificationScript), `Normal verification omits artifact consumption: ${entry.id}`);
    }
  }
  return { packages: entries.length, coordinated: releasePackages.length };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const result = await checkPackages(resolve(import.meta.dirname, '../..'));
  console.log(`Verified ${result.packages} owned packages across root and HTML pipelines; ${result.coordinated} coordinated release targets remain unchanged. Delegated checks were not executed.`);
}
