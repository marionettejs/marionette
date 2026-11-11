import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { candidateOutput, inspectRouterArchive, sha256, validatePreparationReceipt, validateRouterPackage, verifyRouterBrowserReport, verifyRouterDocumentation } from './artifact.mjs';
import { verifyDriverTreeShaking } from './tree-shaking.mjs';
import { verifyHistoryPackage } from './history-package-check.mjs';

const root = resolve(import.meta.dirname, '../..');
const npmCli = process.env.npm_execpath;
if (!npmCli) {throw new Error('Run through npm run test:router-tarball, after npm run build.');}
const { values } = parseArgs({ options: {
  artifact: { type: 'string' }, sha256: { type: 'string' }, output: { type: 'string' },
  'registry-peers': { type: 'boolean', default: false }, browser: { type: 'boolean', default: false },
  'chromium-executable': { type: 'string' },
} });
assert.equal(Boolean(values.artifact), Boolean(values.sha256), '--artifact and --sha256 are required together');
assert.ok(!values['chromium-executable'] || values.browser, '--chromium-executable requires --browser');
const output = values.output && candidateOutput(root, values.output);
if (output) { mkdirSync(output, { recursive: true }); assert.equal(readdirSync(output).length, 0, 'Use a new empty receipt directory'); }
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const report = { schemaVersion: 1, verificationCommit: git(['rev-parse', 'HEAD']), verificationDirty: Boolean(git(['status', '--porcelain'])),
  archiveSourceCommit: null, publishableManifest: false, status: 'running',
  node: process.versions.node, npm: execFileSync(process.execPath, [npmCli, '--version'], { encoding: 'utf8' }).trim(),
  peerMode: values['registry-peers'] ? 'registry' : 'local-development', checks: [] };
const temporary = mkdtempSync(join(tmpdir(), 'mnjs-router-tarball-'));
try {
  const artifacts = join(temporary, 'artifacts');
  const consumer = join(temporary, 'consumer');
  mkdirSync(artifacts);
  mkdirSync(consumer);
  const pack = directory => {
    const [result] = JSON.parse(execFileSync(process.execPath, [npmCli, 'pack', directory,
      '--ignore-scripts', '--json', '--cache', join(temporary, 'cache'), '--pack-destination', artifacts], { cwd: root, encoding: 'utf8' }));
    return join(artifacts, result.filename);
  };
  const routerTarball = values.artifact ? resolve(values.artifact) : pack(join(root, 'packages/router'));
  report.archive = inspectRouterArchive(routerTarball, values.sha256 ?? sha256(readFileSync(routerTarball)));
  report.publishableManifest = true;
  const preparationFile = join(dirname(routerTarball), 'router-candidate.json');
  if (values.artifact && existsSync(preparationFile)) {
    const preparation = JSON.parse(readFileSync(preparationFile));
    report.archiveSourceCommit = validatePreparationReceipt(preparation, report.archive, report.verificationCommit);
    if (output) { cpSync(preparationFile, join(output, 'router-candidate.json')); }
  }
  const peers = values['registry-peers'] ? ['marionette@5.0.1', '@mnjs/utils@5.0.1'] :
    ['.package', 'packages/utils', 'packages/radio'].map(directory => pack(join(root, directory)));
  const exampleDependencies = values['registry-peers'] ? ['@mnjs/adapters@5.0.1', 'lit-html@3.3.3', 'urlpattern-polyfill@10.1.0'] :
    ['packages/adapters', 'node_modules/lit-html', 'node_modules/@types/trusted-types', 'node_modules/urlpattern-polyfill'].map(directory => pack(join(root, directory)));
  writeFileSync(join(consumer, 'package.json'), '{"name":"router-tarball-consumer","private":true,"type":"module"}\n');
  execFileSync(process.execPath, [npmCli, 'install', '--ignore-scripts', '--strict-peer-deps', '--no-audit', '--no-fund',
    ...(values['registry-peers'] ? ['--registry=https://registry.npmjs.org/', '--fetch-retries=0', '--fetch-timeout=20000'] : ['--offline']),
    '--cache', join(temporary, 'cache'), routerTarball, ...peers, ...exampleDependencies], { cwd: consumer, stdio: 'inherit' });
  const installed = join(consumer, 'node_modules/@mnjs/router');
  validateRouterPackage(JSON.parse(readFileSync(join(installed, 'package.json'))), readFileSync(join(installed, 'license.txt')));
  assert.equal(sha256(readFileSync(join(installed, 'dist/index.js'))), report.archive.browserModuleSha256);
  report.documentation = verifyRouterDocumentation(installed);
  const lock = JSON.parse(readFileSync(join(consumer, 'package-lock.json')));
  report.peers = ['marionette', '@mnjs/utils', '@mnjs/radio'].map(name => {
    const entry = lock.packages[`node_modules/${name}`];
    assert.equal(entry.version, '5.0.1');
    if (values['registry-peers']) { assert.ok(entry.resolved.startsWith('https://registry.npmjs.org/')); }
    return { name, version: entry.version, resolved: entry.resolved, integrity: entry.integrity };
  });
  report.exampleDependencies = [['@mnjs/adapters', '5.0.1'], ['lit-html', '3.3.3'], ['urlpattern-polyfill', '10.1.0']].map(([name, version]) => {
    const entry = lock.packages[`node_modules/${name}`];
    assert.equal(entry.version, version);
    if (values['registry-peers']) { assert.ok(entry.resolved.startsWith('https://registry.npmjs.org/')); }
    return { name, version, resolved: entry.resolved, integrity: entry.integrity };
  });
  for (const file of ['DESIGN.md', 'PROVENANCE.md',
    'dist/index.js', 'dist/index.cjs', 'dist/types/esm/index.d.ts', 'dist/types/cjs/index.d.ts']) {
    assert.ok(readFileSync(join(installed, file)).length, file);
  }
  cpSync(join(root, 'test/router/consumer/package-smoke.mjs'), join(consumer, 'smoke.mjs'));
  execFileSync(process.execPath, ['smoke.mjs'], { cwd: consumer, stdio: 'inherit' });
  report.checks.push('installed-esm-cjs');
  const typeFiles = ['router.mts', 'router.cts', 'router-inference.mts', 'router-inference.cts', 'router-checkjs.js'];
  for (const file of typeFiles) { cpSync(join(root, 'test/types', file), join(consumer, file)); }
  writeFileSync(join(consumer, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
    target: 'ES2024', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, skipLibCheck: false,
    noEmit: true, types: [], allowJs: true, checkJs: true,
  }, files: typeFiles }));
  execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], { cwd: consumer, stdio: 'inherit' });
  report.checks.push('installed-esm-cjs-checkjs-types');
  await verifyHistoryPackage(consumer);
  report.checks.push('installed-history-esm-cjs');
  report.treeShaking = await verifyDriverTreeShaking(consumer);
  report.checks.push('optimized-esm-driver-consumers');
  writeFileSync(join(consumer, 'correctness-probes.mjs'), readFileSync(join(root, 'test/router/correctness-probes.mjs')));
  execFileSync(process.execPath, ['correctness-probes.mjs'], { cwd: consumer, stdio: 'inherit' });
  cpSync(join(installed, 'examples/desk'), join(consumer, 'desk'), { recursive: true });
  cpSync(join(root, 'test/router/consumer'), join(consumer, 'desk'), { recursive: true });
  cpSync(join(installed, 'examples/catalog'), join(consumer, 'catalog'), { recursive: true });
  cpSync(join(root, 'test/router/consumer/catalog-verify.mjs'), join(consumer, 'catalog/verify.mjs'));
  execFileSync(process.execPath, ['desk/capabilities-probe.mjs'], { cwd: consumer, stdio: 'inherit' });
  execFileSync(process.execPath, ['desk/capabilities-absent.mjs'], { cwd: consumer, stdio: 'inherit' });
  execFileSync(process.execPath, [join(root, 'test/router/consumer-check.mjs'), consumer], { cwd: consumer, stdio: 'inherit' });
  // Break copies of the shipped example, then require the real consumer checks
  // to reject missing rendering and unsafe HTML. Restore before native verification.
  const catalogFile = join(consumer, 'catalog/catalog.mjs');
  const catalogSource = readFileSync(catalogFile, 'utf8');
  const template = 'template: ({ title }) => html`<h1>${title}</h1>`';
  assert.ok(catalogSource.includes(template));
  for (const [replacement, diagnostic] of [
    ['template: false', 'CatalogView must render its template'],
    ['template: ({ title }) => html`<h1>${unsafeHTML(title)}</h1>`', 'Fetched titles must remain text'],
  ]) {
    try {
      writeFileSync(catalogFile, `import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';\n${catalogSource.replace(template, replacement)}`);
      const broken = spawnSync(process.execPath, [join(root, 'test/router/consumer-check.mjs'), consumer, '--catalog-only'], { cwd: consumer, encoding: 'utf8' });
      assert.equal(broken.error, undefined);
      assert.notEqual(broken.status, 0, 'Controlled example break must fail');
      assert.ok(broken.stderr.includes(diagnostic), broken.stderr);
    } finally { writeFileSync(catalogFile, catalogSource); }
  }
  report.checks.push('example-template-escaping-controlled-breaks');
  report.checks.push('cancellation-retention-capabilities-route-owning-examples');
  if (values.browser) {
    const packages = [['utils', '@mnjs/utils'], ['radio', '@mnjs/radio'], ['core', 'marionette'], ['adapters', '@mnjs/adapters'], ['router', '@mnjs/router']].map(([id, name]) => {
      const directory = join(consumer, 'node_modules', name);
      return { id, name, directory, manifest: JSON.parse(readFileSync(join(directory, 'package.json'))) };
    });
    const candidate = join(temporary, 'browser-candidate.json');
    writeFileSync(candidate, JSON.stringify({ source: { commit: report.archiveSourceCommit, verificationCommit: report.verificationCommit },
      packages: packages.filter(entry => entry.id !== 'router'),
      routerPackage: packages.find(entry => entry.id === 'router'), routerArchive: report.archive,
      litDirectory: join(consumer, 'node_modules/lit-html'),
      urlPatternDirectory: join(consumer, 'node_modules/urlpattern-polyfill') }));
    execFileSync(process.execPath, [npmCli, 'run', 'test:router-browser'], { cwd: root, stdio: 'inherit', env: {
      ...process.env, MARIONETTE_BROWSER_CANDIDATE: candidate, MARIONETTE_ROUTER_PACKAGE_DIRECTORY: installed,
      ...(values['chromium-executable'] ? { MARIONETTE_ROUTER_CHROMIUM: resolve(values['chromium-executable']) } : {}),
    } });
    const results = JSON.parse(readFileSync(join(root, 'test/tmp/router-browser/results.json')));
    const inventory = JSON.parse(readFileSync(join(root, 'test/router/browser-inventory.json')));
    report.browser = verifyRouterBrowserReport(results, inventory);
    report.checks.push('chromium-native-and-history-exact-router-archive');
    if (output) { cpSync(join(root, 'test/tmp/router-browser/results.json'), join(output, 'browser-results.json')); }
  }
  assert.equal(git(['rev-parse', 'HEAD']), report.verificationCommit, 'Source changed during verification');
  report.verificationDirty ||= Boolean(git(['status', '--porcelain']));
  report.status = 'passed-public-candidate';
  if (output) { cpSync(join(consumer, 'package-lock.json'), join(output, 'installed-package-lock.json')); }
  console.log(`Router tarball SHA-256: ${createHash('sha256').update(readFileSync(routerTarball)).digest('hex')}`);
} catch (error) {
  report.status = 'failed';
  report.error = error.message;
  throw error;
} finally {
  if (output) { writeFileSync(join(output, 'router-verification.json'), `${JSON.stringify(report, null, 2)}\n`); }
  rmSync(temporary, { recursive: true, force: true });
}
