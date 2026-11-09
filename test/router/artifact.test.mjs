import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { candidateOutput, inspectRouterArchive, sha256, validatePreparationReceipt, validateRouterPackage, verifyRouterBrowserReport, verifyRouterDocumentation } from './artifact.mjs';

const root = resolve(import.meta.dirname, '../..');
const manifest = JSON.parse(readFileSync(join(root, 'packages/router/package.json')));
const notice = readFileSync(join(root, 'license.txt'));

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'router-artifact-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const pkg = join(directory, 'package');
  const write = (path, content) => { mkdirSync(dirname(join(pkg, path)), { recursive: true }); writeFileSync(join(pkg, path), content); };
  write('package.json', JSON.stringify(manifest));
  write('license.txt', notice);
  write('readme.md', '# Router\n[Design](DESIGN.md#child-applications)\n[MIT](license.txt)\n');
  write('DESIGN.md', '# Design\n## Child applications\n');
  write('PROVENANCE.md', '# Provenance\n');
  for (const file of ['examples/desk/README.md', 'examples/desk/desk.mjs',
    'examples/catalog/README.md', 'examples/catalog/catalog.mjs']) { write(file, '# Example\n'); }
  for (const kind of ['import', 'require']) {
    for (const field of ['default', 'types']) { write(manifest.exports['.'][kind][field], 'export {};\n'); }
  }
  const pack = () => {
    const files = [];
    const walk = path => {
      for (const item of readdirSync(join(directory, path), { withFileTypes: true })) {
        const file = `${path}/${item.name}`;
        if (item.isDirectory()) { walk(file); } else { files.push(file); }
      }
    };
    walk('package');
    const archive = join(directory, 'router.tgz');
    execFileSync('tar', ['-czf', archive, '-C', directory, ...files]);
    return archive;
  };
  return { directory, pkg, write, pack };
}

test('accepts only a private MIT package preserving exact attribution and peers', () => {
  validateRouterPackage(manifest, notice);
  for (const changed of [{ ...manifest, private: false }, { ...manifest, license: 'UNLICENSED' },
    { ...manifest, version: '99.0.0' }, { ...manifest, dependencies: { '@mnjs/utils': '^5.0.1' } },
    { ...manifest, peerDependencies: { marionette: '^5.0.1' } }]) {
    assert.throws(() => validateRouterPackage(changed, notice));
  }
  assert.throws(() => validateRouterPackage(manifest, Buffer.from('MIT without the existing attribution')), /exact Marionette/);
});

test('inspects the actual archive and records its license and browser bytes', t => {
  const f = fixture(t);
  const archive = f.pack();
  const receipt = inspectRouterArchive(archive, sha256(readFileSync(archive)));
  assert.equal(receipt.publicationAllowed, false);
  assert.equal(receipt.licenseSha256, sha256(notice));
  assert.equal(receipt.browserModuleSha256, sha256(readFileSync(join(f.pkg, 'dist/index.js'))));
  assert.ok(receipt.files.includes('license.txt'));
  assert.throws(() => inspectRouterArchive(archive, '0'.repeat(64)), /SHA256 mismatch/);
});

test('rejects unexpected packed material and missing public entries', t => {
  const f = fixture(t);
  f.write('.npmrc', 'unexpected package file');
  let archive = f.pack();
  assert.throws(() => inspectRouterArchive(archive, sha256(readFileSync(archive))), /Unexpected router payload/);
  rmSync(join(f.pkg, '.npmrc'));
  rmSync(join(f.pkg, 'dist/index.cjs'));
  archive = f.pack();
  assert.throws(() => inspectRouterArchive(archive, sha256(readFileSync(archive))), /Missing entry/);
});

test('checks installed documentation anchors, files and package boundaries', t => {
  const f = fixture(t);
  assert.deepEqual(verifyRouterDocumentation(f.pkg), { pages: 5, relativeLinks: 2 });
  f.write('readme.md', '[Missing](DESIGN.md#missing)');
  assert.throws(() => verifyRouterDocumentation(f.pkg), /Missing anchor/);
  f.write('readme.md', '[Missing](absent.md)');
  assert.throws(() => verifyRouterDocumentation(f.pkg), /ENOENT/);
  f.write('readme.md', '[Outside](../outside.md)');
  assert.throws(() => verifyRouterDocumentation(f.pkg), /escapes installed router/);
});

test('neither preparation entry point accepts a publication mode', () => {
  for (const file of ['prepare.mjs', 'tarball.mjs']) {
    const result = spawnSync(process.execPath, [join(root, 'test/router', file), '--publish'], {
      encoding: 'utf8', env: { ...process.env, npm_execpath: 'unused-before-argument-validation' },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unknown option '--publish'/);
  }
});

test('binds preparation source to the archive instead of attributing it to a different verifier commit', () => {
  const commitA = 'a'.repeat(40);
  const commitB = 'b'.repeat(40);
  const archive = { sha256: 'c'.repeat(64), bytes: 100, name: '@mnjs/router', version: manifest.version,
    licenseSha256: sha256(notice), browserModuleSha256: 'd'.repeat(64) };
  const receipt = { schemaVersion: 1, sourceCommit: commitA, sourceDirty: false, publicationAllowed: false, archive };
  assert.equal(validatePreparationReceipt(receipt, archive, commitA), commitA);
  assert.throws(() => validatePreparationReceipt(receipt, archive, commitB), /source commits differ/);
  assert.throws(() => validatePreparationReceipt(receipt, { ...archive, sha256: 'e'.repeat(64) }, commitA), /sha256 differs/);
  assert.throws(() => validatePreparationReceipt({ ...receipt, sourceDirty: true }, archive, commitA));
  assert.throws(() => validatePreparationReceipt({ ...receipt, publicationAllowed: true }, archive, commitA));
});

test('keeps output outside the source even through an existing directory alias', t => {
  const f = fixture(t);
  const outside = join(f.directory, 'receipts');
  assert.equal(candidateOutput(f.pkg, outside), outside);
  assert.throws(() => candidateOutput(f.pkg, f.pkg), /outside the source/);
  const alias = join(f.directory, 'alias');
  symlinkSync(f.pkg, alias, 'junction');
  assert.throws(() => candidateOutput(f.pkg, join(alias, 'new-output')), /outside the source/);
});

test('browser evidence requires every declared case once and an actual executable version', () => {
  const inventory = { schemaVersion: 1, policy: 'initial-chromium', tests: [{ file: 'router.spec.mjs', title: 'route' }] };
  const report = { config: { metadata: { routerBrowserVersion: 'Chromium 154' } }, errors: [],
    stats: { expected: 1, skipped: 0, flaky: 0, unexpected: 0 }, suites: [{ specs: [{ file: 'router.spec.mjs', title: 'route',
      tests: [{ projectName: 'router-chromium', status: 'expected', expectedStatus: 'passed', results: [{ status: 'passed' }] }] }] }] };
  assert.equal(verifyRouterBrowserReport(report, inventory).version, 'Chromium 154');
  for (const mutate of [r => { r.config.metadata = {}; }, r => { r.errors.push({ message: 'runner error' }); },
    r => { r.stats.skipped = 1; }, r => { r.stats.expected = 2; }, r => { r.suites = []; },
    r => { r.suites[0].specs[0].tests[0].results.push({ status: 'passed' }); },
    r => { r.suites[0].specs[0].tests[0].projectName = 'webkit'; }]) {
    const changed = structuredClone(report);
    mutate(changed);
    assert.throws(() => verifyRouterBrowserReport(changed, inventory));
  }
});

test('router discovery uses the complete Chromium inventory in dedicated and development configurations', () => {
  const discover = config => {
    const result = JSON.parse(execFileSync(process.execPath, [join(root, 'node_modules/@playwright/test/cli.js'), 'test',
      '--config', config, '--list', '--reporter=json'], { cwd: root, encoding: 'utf8' }));
    const cases = [];
    const visit = suites => {
      for (const suite of suites) {
        for (const spec of suite.specs ?? []) { for (const entry of spec.tests) { cases.push([spec.file, spec.title, entry.projectName]); } }
        visit(suite.suites ?? []);
      }
    };
    visit(result.suites);
    return cases.map(entry => JSON.stringify(entry)).sort();
  };
  const router = JSON.parse(readFileSync(join(root, 'test/router/browser-inventory.json'))).tests;
  assert.deepEqual(discover('playwright.router.config.mjs'), router.map(({ file, title }) => JSON.stringify([file, title, 'router-chromium'])).sort());
  const regular = discover('playwright.config.mjs').map(entry => JSON.parse(entry)).filter(([file]) => file.startsWith('router-'));
  assert.deepEqual(regular.map(entry => JSON.stringify(entry)).sort(), router.map(({ file, title }) => JSON.stringify([file, title, 'chromium'])).sort());
});
