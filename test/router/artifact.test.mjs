import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { candidateOutput, inspectRouterArchive, sha256, validatePreparationReceipt, validateRouterPackage, verifyRouterBrowserReport, verifyRouterDocumentation } from './artifact.mjs';
import { verifyLazyHistoryBrowserReport } from './lazy-history-browser.mjs';

const root = resolve(import.meta.dirname, '../..');
const manifest = JSON.parse(readFileSync(join(root, 'packages/router/package.json')));
const notice = readFileSync(join(root, 'license.txt'));

test('standalone browser evidence requires every engine, probe mode and Chromium sandbox', () => {
  const report = { policy: 'chromium-firefox-webkit', engines: ['chromium', 'firefox', 'webkit'].map(name => ({
    name, version: 'recorded executable', status: 'passed', ...(name === 'chromium' ? { chromiumSandbox: true } : {}),
    branches: ['available', 'undefined', 'throwing'].map(mode => ({
      mode, fallback: mode !== 'available', initialDispatch: 'matched', navigationStateAndBack: 'passed',
      navigationGetterReads: mode === 'throwing' ? 1 : 0,
    })),
  })) };
  assert.deepEqual(verifyLazyHistoryBrowserReport(report), { engines: 3, cases: 9 });
  for (const change of [
    value => value.engines.pop(),
    value => { value.engines[1].name = 'chromium'; },
    value => { value.engines[0].chromiumSandbox = false; },
    value => { value.engines[1].status = 'failed'; },
    value => value.engines[2].branches.pop(),
    value => { value.engines[2].branches[2].navigationGetterReads = 2; },
  ]) {
    const broken = structuredClone(report); change(broken);
    assert.throws(() => verifyLazyHistoryBrowserReport(broken));
  }
});

for (const outcome of ['success', 'nonzero', 'launch-error', 'timeout']) {
  test(`retention launcher bounds children and preserves ${outcome} diagnostics`, () => {
    const program = `
      import assert from 'node:assert/strict';
      import { spawnSync } from 'node:child_process';
      import { verifyHistoryRetention } from ${JSON.stringify(pathToFileURL(join(root, 'test/router/history-retention-probes.mjs')).href)};
      const outcome = ${JSON.stringify(outcome)};
      const modes = []; const children = [];
      const launch = (executable, args, options) => {
        assert.ok(Number.isFinite(options.timeout) && options.timeout > 0 && options.timeout <= 30000);
        assert.equal(options.killSignal, 'SIGKILL');
        assert.equal(args[0], '--expose-gc');
        modes.push(args.at(-1));
        const source = outcome === 'timeout' ? 'process.on("SIGTERM",()=>{}); setInterval(()=>{},1000)' :
          'console.log("fixture stdout"); console.error("fixture stderr"); process.exitCode=' + (outcome === 'nonzero' ? 7 : 0);
        const child = spawnSync(outcome === 'launch-error' ? '/missing-router-retention-executable' : executable,
          ['-e', source], { ...options, timeout: 500 });
        children.push({ status: child.status, signal: child.signal, code: child.error?.code });
        return child;
      };
      let failure;
      try { verifyHistoryRetention(${JSON.stringify(root)}, launch); } catch (error) {
        assert.ok(error instanceof AggregateError);
        failure = error.errors.map(item => ({ message: item.message, code: item.cause?.code }));
      }
      console.log('RETENTION_RESULT ' + JSON.stringify({ modes, children, failure }));
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', program], {
      encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL',
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout.match(/^RETENTION_RESULT (.+)$/m)[1]);
    assert.deepEqual(report.modes, ['complete', 'failed', 'veto']);
    if (outcome === 'success') {
      assert.equal(report.failure, undefined);
      assert.ok(report.children.every(child => child.status === 0));
    } else {
      assert.equal(report.failure.length, 3);
      for (const [index, failure] of report.failure.entries()) {
        assert.match(failure.message, new RegExp(`History retention ${report.modes[index]}:`));
        if (outcome === 'nonzero') { assert.match(failure.message, /exit 7/); } else {
          assert.equal(failure.code, outcome === 'timeout' ? 'ETIMEDOUT' : 'ENOENT');
        }
      }
      if (outcome === 'timeout') { assert.ok(report.children.every(child => child.signal === 'SIGKILL')); }
    }
    if (outcome === 'success' || outcome === 'nonzero') {
      assert.equal(result.stdout.match(/fixture stdout/g).length, 3);
      assert.equal(result.stderr.match(/fixture stderr/g).length, 3);
    }
    assert.doesNotMatch(result.stderr, /ERR_INVALID_ARG_TYPE/);
  });
}

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
  write('changelog.md', '# Changelog\n');
  for (const file of ['examples/desk/README.md', 'examples/desk/desk.mjs',
    'examples/catalog/README.md', 'examples/catalog/catalog.mjs']) { write(file, '# Example\n'); }
  for (const entry of ['.', './history']) {
    for (const kind of ['import', 'require']) {
      for (const field of ['default', 'types']) { write(manifest.exports[entry][kind][field], 'export {};\n'); }
    }
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

test('accepts only a public MIT package preserving exact attribution and peers', () => {
  validateRouterPackage(manifest, notice);
  for (const changed of [{ ...manifest, private: true }, { ...manifest, private: false },
    { ...manifest, publishConfig: { access: 'restricted', registry: 'https://registry.npmjs.org/' } },
    { ...manifest, publishConfig: { access: 'public', registry: 'https://unapproved.example/' } }, { ...manifest, license: 'UNLICENSED' },
    { ...manifest, version: '99.0.0' }, { ...manifest, dependencies: { '@mnjs/utils': '5.0.1' } },
    { ...manifest, dependencies: { '@mnjs/utils': '^5.0.0' } },
    { ...manifest, peerDependencies: { marionette: '5.0.1' } }]) {
    assert.throws(() => validateRouterPackage(changed, notice));
  }
  assert.throws(() => validateRouterPackage(manifest, Buffer.from('MIT without the existing attribution')), /exact Marionette/);
});

test('inspects the actual archive and records its license and browser bytes', t => {
  const f = fixture(t);
  const archive = f.pack();
  const receipt = inspectRouterArchive(archive, sha256(readFileSync(archive)));
  assert.equal(receipt.publishableManifest, true);
  assert.equal(receipt.licenseSha256, sha256(notice));
  assert.equal(receipt.browserModuleSha256, sha256(readFileSync(join(f.pkg, 'dist/index.js'))));
  assert.ok(receipt.files.includes('license.txt'));
  assert.throws(() => inspectRouterArchive(archive, '0'.repeat(64)), /SHA256 mismatch/);
});

test('failed archive validation does not claim a publishable manifest', t => {
  const f = fixture(t);
  f.write('package.json', JSON.stringify({ ...manifest, private: true }));
  const archive = f.pack();
  const output = join(f.directory, 'verification');
  const result = spawnSync(process.execPath, [join(root, 'test/router/tarball.mjs'), '--artifact', archive,
    '--sha256', sha256(readFileSync(archive)), '--output', output], { encoding: 'utf8', env: process.env });
  assert.notEqual(result.status, 0);
  const receipt = JSON.parse(readFileSync(join(output, 'router-verification.json')));
  assert.equal(receipt.status, 'failed');
  assert.equal(receipt.publishableManifest, false);
  assert.deepEqual(receipt.checks, []);
});

test('rejects unexpected packed material and missing public entries', t => {
  const f = fixture(t);
  f.write('.npmrc', 'unexpected package file');
  const archive = f.pack();
  assert.throws(() => inspectRouterArchive(archive, sha256(readFileSync(archive))), /Unexpected router payload/);
  rmSync(join(f.pkg, '.npmrc'));
  for (const entry of ['dist/index.cjs', 'changelog.md']) {
    rmSync(join(f.pkg, entry));
    const incomplete = f.pack();
    assert.throws(() => inspectRouterArchive(incomplete, sha256(readFileSync(incomplete))), /Missing entry/);
    f.write(entry, 'fixture\n');
  }
});

test('requires every public History runtime and declaration in the archive', t => {
  const f = fixture(t);
  for (const kind of ['import', 'require']) {
    for (const field of ['default', 'types']) {
      const entry = manifest.exports['./history'][kind][field];
      rmSync(join(f.pkg, entry));
      const archive = f.pack();
      assert.throws(() => inspectRouterArchive(archive, sha256(readFileSync(archive))), /Missing entry/);
      f.write(entry, 'export {};\n');
    }
  }
});

test('checks installed documentation anchors, files and package boundaries', t => {
  const f = fixture(t);
  assert.deepEqual(verifyRouterDocumentation(f.pkg), { pages: 6, relativeLinks: 2 });
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

test('registry peer selection requires registry mode and an explicit supported evidence version', () => {
  const currentVersion = JSON.parse(readFileSync(join(root, 'package.json'))).version;
  for (const [args, diagnostic] of [
    [['--registry-peer-version', currentVersion], /requires --registry-peers/],
    [['--registry-peers', '--registry-peer-version', '5.0.0'], /minimum 5.0.1 or current/],
    [['--registry-peers', '--registry-peer-version', '^5.0.1'], /minimum 5.0.1 or current/],
    [['--registry-peers', '--registry-peer-version', 'latest'], /minimum 5.0.1 or current/],
  ]) {
    const result = spawnSync(process.execPath, [join(root, 'test/router/tarball.mjs'), ...args], {
      encoding: 'utf8', env: { ...process.env, npm_execpath: 'unused-before-argument-validation' },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, diagnostic);
  }
});

test('binds preparation source to the archive instead of attributing it to a different verifier commit', () => {
  const commitA = 'a'.repeat(40);
  const commitB = 'b'.repeat(40);
  const archive = { sha256: 'c'.repeat(64), bytes: 100, name: '@mnjs/router', version: manifest.version,
    licenseSha256: sha256(notice), browserModuleSha256: 'd'.repeat(64) };
  const receipt = { schemaVersion: 1, sourceCommit: commitA, sourceDirty: false, publishableManifest: true, archive };
  assert.equal(validatePreparationReceipt(receipt, archive, commitA), commitA);
  assert.throws(() => validatePreparationReceipt(receipt, archive, commitB), /source commits differ/);
  assert.throws(() => validatePreparationReceipt(receipt, { ...archive, sha256: 'e'.repeat(64) }, commitA), /sha256 differs/);
  assert.throws(() => validatePreparationReceipt({ ...receipt, sourceDirty: true }, archive, commitA));
  assert.throws(() => validatePreparationReceipt({ ...receipt, publishableManifest: false }, archive, commitA));
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

test('browser evidence requires every case once on each engine and actual versions', () => {
  const names = ['chromium', 'firefox', 'webkit'];
  const inventory = { schemaVersion: 1, policy: 'chromium-firefox-webkit', tests: [{ file: 'router.spec.mjs', title: 'route' }] };
  const versions = { chromium: '158.0.8127.18', firefox: '159.0', webkit: '27.2' };
  const report = { errors: [],
    stats: { expected: 3, skipped: 0, flaky: 0, unexpected: 0 }, suites: [{ specs: [{ file: 'router.spec.mjs', title: 'route',
      tests: names.map(name => ({ projectName: `router-${name}`, annotations: [{ type: 'browser-version', description: versions[name] }], status: 'expected', expectedStatus: 'passed', results: [{ status: 'passed', retry: 0 }] })) }] }] };
  assert.deepEqual(verifyRouterBrowserReport(report, inventory).engines, names.map(name => ({
    name, version: versions[name], expected: 1,
  })));
  for (const mutate of [r => { r.errors.push({ message: 'runner error' }); },
    r => { r.errors = ''; }, r => { r.errors = { length: 0 }; },
    r => { r.stats.skipped = 1; }, r => { r.stats.flaky = 1; }, r => { r.stats.unexpected = 1; },
    r => { r.stats.skipped = -1; r.stats.flaky = 1; },
    r => { r.stats.expected = 4; }, r => { r.suites = []; },
    r => { r.suites[0].specs[0].tests[0].results.push({ status: 'passed', retry: 1 }); },
    r => { r.suites[0].specs[0].tests[0].results[0].retry = 1; },
    r => { r.suites[0].specs[0].tests[0].expectedStatus = 'failed'; },
    r => { r.suites[0].specs[0].tests[0].projectName = 'webkit'; },
    r => { r.suites[0].specs[0].tests.push(structuredClone(r.suites[0].specs[0].tests[0])); },
  ]) {
    const changed = structuredClone(report);
    mutate(changed);
    assert.throws(() => verifyRouterBrowserReport(changed, inventory));
  }
  for (const index of names.keys()) {
    for (const mutate of [r => { r.suites[0].specs[0].tests[index].annotations = []; },
      r => { r.suites[0].specs[0].tests[index].annotations[0].description = ' '; },
      r => { r.suites[0].specs[0].tests[index].annotations.push({ type: 'browser-version', description: 'other' }); },
      r => { r.suites[0].specs[0].tests.splice(index, 1); r.stats.expected--; },
      r => { r.suites[0].specs[0].tests[index].results[0].status = 'skipped'; },
      r => { r.suites[0].specs[0].tests[index].status = 'flaky'; }]) {
      const changed = structuredClone(report);
      mutate(changed);
      assert.throws(() => verifyRouterBrowserReport(changed, inventory));
    }
  }
  const inconsistent = structuredClone(report);
  const second = structuredClone(inconsistent.suites[0].specs[0]); second.title = 'other route';
  second.tests[0].annotations[0].description = 'other build';
  inconsistent.suites[0].specs.push(second); inconsistent.stats.expected = 6;
  assert.throws(() => verifyRouterBrowserReport(inconsistent, { ...inventory, tests: [...inventory.tests,
    { file: 'router.spec.mjs', title: 'other route' }] }), /Consistent chromium executables/);
  assert.throws(() => verifyRouterBrowserReport(report, { ...inventory, policy: 'initial-chromium' }));
  assert.throws(() => verifyRouterBrowserReport(report, { ...inventory, tests: [...inventory.tests, ...inventory.tests] }));
});

test('router discovery uses every inventory case on all engines in both configurations', () => {
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
  const expected = prefix => router.flatMap(({ file, title }) => ['chromium', 'firefox', 'webkit']
    .map(name => JSON.stringify([file, title, `${prefix}${name}`]))).sort();
  assert.deepEqual(discover('playwright.router.config.mjs'), expected('router-'));
  const regular = discover('playwright.config.mjs').map(entry => JSON.parse(entry)).filter(([file]) => file.startsWith('router-'));
  assert.deepEqual(regular.map(entry => JSON.stringify(entry)).sort(), expected(''));
  const core = discover('playwright.core-release.config.mjs').map(entry => JSON.parse(entry));
  assert.ok(core.length > 0);
  assert.ok(core.every(([file]) => !file.startsWith('router-')), 'Core release retains its separate inventory');
  const diagnostic = discover('playwright.router-diagnostics.config.mjs').map(entry => JSON.parse(entry));
  assert.equal(diagnostic.length, 6, 'Two native contract cases on each engine');
  assert.ok(diagnostic.every(([, title]) => title === 'native Back to a distinct earlier entry supersedes the still-preparing destination' ||
    title === 'native queued Back dispatch follows completed abort-listener navigation'));
  assert.deepEqual([...new Set(diagnostic.map(([, , project]) => project))].sort(), ['chromium', 'firefox', 'webkit']);
});

test('Router projects launch their named engines and preserve Chromium sandboxing', async() => {
  const { default: dedicated } = await import('../../playwright.router.config.mjs');
  const { default: development } = await import('../../playwright.config.mjs');
  const { default: diagnostic } = await import('../../playwright.router-diagnostics.config.mjs');
  assert.equal(diagnostic.metadata.routerNativeTrace, true);
  assert.notEqual(diagnostic.outputDir, development.outputDir);
  assert.notEqual(diagnostic.reporter[1][1].outputFile, development.reporter[2][1].outputFile);
  const names = ['chromium', 'firefox', 'webkit'];
  assert.deepEqual(dedicated.projects.map(({ name, use }) => [name, use.browserName]),
    names.map(name => [`router-${name}`, name]));
  assert.equal(dedicated.projects[0].use.launchOptions.chromiumSandbox, true);
  assert.deepEqual(development.projects.map(({ name, use }) => [name, use.browserName]),
    names.map(name => [name, name]));
});
