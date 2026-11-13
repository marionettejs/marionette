import assert from 'node:assert/strict';
import { htmlCandidate } from '../docs/html-candidate.mjs';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { candidateOutput, inspectRouterArchive, sha256, validatePreparationReceipt, validateRouterPackage, verifyRouterDocumentation } from './artifact.mjs';
import { verifyDriverTreeShaking } from './tree-shaking.mjs';
import { verifyLazyHistory } from './lazy-history.mjs';
import { verifyHistoryPackage } from './history-package-check.mjs';
import { runRouterBrowserExecutions, verifyRouterBrowserExecutions } from './browser-executions.mjs';

const root = resolve(import.meta.dirname, '../..');
// Keep the published minimum-compatibility lane independent of the local candidate.
const minimumRegistryPeerVersion = '5.0.1';
const currentCoreVersion = JSON.parse(readFileSync(join(root, 'package.json'))).version;
const npmCli = process.env.npm_execpath;
if (!npmCli) {throw new Error('Run through npm run test:router-tarball, after npm run build.');}
const { values } = parseArgs({ options: {
  artifact: { type: 'string' }, sha256: { type: 'string' }, output: { type: 'string' },
  'registry-peers': { type: 'boolean', default: false },
  'registry-peer-version': { type: 'string' }, browser: { type: 'boolean', default: false },
  'chromium-executable': { type: 'string' },
} });
assert.equal(Boolean(values.artifact), Boolean(values.sha256), '--artifact and --sha256 are required together');
assert.ok(!values['chromium-executable'] || values.browser, '--chromium-executable requires --browser');
assert.ok(!values['registry-peer-version'] || values['registry-peers'], '--registry-peer-version requires --registry-peers');
const registryPeerVersion = values['registry-peer-version'] ?? minimumRegistryPeerVersion;
assert.ok([minimumRegistryPeerVersion, currentCoreVersion].includes(registryPeerVersion),
  '--registry-peer-version must be the minimum 5.0.1 or current coordinated source version');
const output = values.output && candidateOutput(root, values.output);
if (output) { mkdirSync(output, { recursive: true }); assert.equal(readdirSync(output).length, 0, 'Use a new empty receipt directory'); }
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const report = { schemaVersion: 1, verificationCommit: git(['rev-parse', 'HEAD']), verificationDirty: Boolean(git(['status', '--porcelain'])),
  archiveSourceCommit: null, publishableManifest: false, status: 'running',
  node: process.versions.node, npm: execFileSync(process.execPath, [npmCli, '--version'], { encoding: 'utf8' }).trim(),
  host: { platform: process.platform, architecture: process.arch },
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
  const peers = values['registry-peers'] ? [`marionette@${registryPeerVersion}`, `@mnjs/utils@${registryPeerVersion}`] :
    ['.package', 'packages/utils', 'packages/radio'].map(directory => pack(join(root, directory)));
  const renderer = htmlCandidate();
  report.renderer = renderer;
  const exampleDependencies = values['registry-peers'] ? [`@mnjs/adapters@${registryPeerVersion}`, 'lit-html@3.3.3', 'urlpattern-polyfill@10.1.0'] :
    ['packages/adapters', 'node_modules/lit-html', 'node_modules/@types/trusted-types', 'node_modules/urlpattern-polyfill'].map(directory => pack(join(root, directory)));
  writeFileSync(join(consumer, 'package.json'), '{"name":"router-tarball-consumer","private":true,"type":"module"}\n');
  execFileSync(process.execPath, [npmCli, 'install', '--ignore-scripts', '--strict-peer-deps', '--no-audit', '--no-fund',
    ...(values['registry-peers'] ? ['--registry=https://registry.npmjs.org/', '--fetch-retries=0', '--fetch-timeout=20000'] : ['--offline']),
    '--cache', join(temporary, 'cache'), routerTarball, renderer.path, ...peers, ...exampleDependencies], { cwd: consumer, stdio: 'inherit' });
  const installed = join(consumer, 'node_modules/@mnjs/router');
  validateRouterPackage(JSON.parse(readFileSync(join(installed, 'package.json'))), readFileSync(join(installed, 'license.txt')));
  assert.equal(sha256(readFileSync(join(installed, 'dist/index.js'))), report.archive.browserModuleSha256);
  report.documentation = verifyRouterDocumentation(installed);
  const lock = JSON.parse(readFileSync(join(consumer, 'package-lock.json')));
  if (output) { cpSync(join(consumer, 'package-lock.json'), join(output, 'installed-package-lock.json')); }
  const candidateVersion = directory => JSON.parse(readFileSync(join(root, directory, 'package.json'))).version;
  report.peers = [['marionette', '.package'], ['@mnjs/utils', 'packages/utils'], ['@mnjs/radio', 'packages/radio']].map(([name, directory]) => {
    const entry = lock.packages[`node_modules/${name}`];
    assert.equal(entry.version, values['registry-peers'] ? registryPeerVersion : candidateVersion(directory));
    if (values['registry-peers']) { assert.ok(entry.resolved.startsWith('https://registry.npmjs.org/')); }
    return { name, version: entry.version, resolved: entry.resolved, integrity: entry.integrity };
  });
  const installedRenderer = JSON.parse(readFileSync(join(consumer, 'node_modules/@mnjs/html/package.json')));
  assert.equal(installedRenderer.version, renderer.version);
  report.exampleDependencies = [['@mnjs/adapters', values['registry-peers'] ? registryPeerVersion : candidateVersion('packages/adapters')], ['lit-html', '3.3.3'], ['urlpattern-polyfill', '10.1.0']].map(([name, version]) => {
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
  report.lazyHistory = await verifyLazyHistory(consumer);
  report.checks.push('vite-production-lazy-history');
  if (output) { cpSync(join(consumer, 'router-lazy-history'), join(output, 'router-lazy-history'), { recursive: true }); }
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
      const unsafeImport = catalogSource.includes('from \'@mnjs/html\'') ? '@mnjs/html/directives/unsafe-html.js' : 'lit-html/directives/unsafe-html.js';
      writeFileSync(catalogFile, `import { unsafeHTML } from '${unsafeImport}';\n${catalogSource.replace(template, replacement)}`);
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
      renderer: { id: 'html', name: '@mnjs/html', directory: join(consumer, 'node_modules/@mnjs/html'), manifest: installedRenderer },
      routerPackage: packages.find(entry => entry.id === 'router'), routerArchive: report.archive,
      litDirectory: join(consumer, 'node_modules/lit-html'),
      urlPatternDirectory: join(consumer, 'node_modules/urlpattern-polyfill') }));
    const browserDirectory = join(root, 'test/tmp/router-browser');
    const browserFailures = [];
    try {
      const execution = runRouterBrowserExecutions({ root, directory: browserDirectory,
        probes: process.env.MARIONETTE_ROUTER_BROWSER_PROBES ? JSON.parse(readFileSync(process.env.MARIONETTE_ROUTER_BROWSER_PROBES, 'utf8')) : undefined,
        blockedChromium: process.env.MARIONETTE_ROUTER_CHROMIUM_SETUP_ERROR, env: {
          ...process.env, MARIONETTE_BROWSER_CANDIDATE: candidate, MARIONETTE_ROUTER_PACKAGE_DIRECTORY: installed,
          ...(values['chromium-executable'] ? { MARIONETTE_ROUTER_CHROMIUM: resolve(values['chromium-executable']) } : {}),
        } });
      report.browserExecutions = execution.attempts;
      const inventory = JSON.parse(readFileSync(join(root, 'test/router/browser-inventory.json')));
      report.browser = verifyRouterBrowserExecutions(execution, inventory);
      report.checks.push('chromium-firefox-webkit-native-and-history-exact-router-archive');
    } catch (error) {
      report.rootBrowserError = error.message;
      browserFailures.push(error);
    } finally {
      if (output && existsSync(browserDirectory)) { cpSync(browserDirectory, join(output, 'browser-evidence'), { recursive: true }); }
    }
    try {
      report.lazyHistory = await verifyLazyHistory(consumer, { browser: true,
        executablePath: values['chromium-executable'] && resolve(values['chromium-executable']),
      });
      report.checks.push('chromium-firefox-webkit-standalone-history-downloads');
    } catch (error) {
      report.standaloneBrowserError = error.message;
      report.lazyHistory = JSON.parse(readFileSync(join(consumer, 'router-lazy-history/report.json')));
      browserFailures.push(error);
    } finally {
      if (output) { cpSync(join(consumer, 'router-lazy-history'), join(output, 'router-lazy-history'), { recursive: true }); }
    }
    if (browserFailures.length) { throw new AggregateError(browserFailures, 'Router browser verification failed'); }
  }
  assert.equal(git(['rev-parse', 'HEAD']), report.verificationCommit, 'Source changed during verification');
  report.verificationDirty ||= Boolean(git(['status', '--porcelain']));
  report.status = 'passed-public-candidate';
  console.log(`Router tarball SHA-256: ${createHash('sha256').update(readFileSync(routerTarball)).digest('hex')}`);
} catch (error) {
  report.status = 'failed';
  report.error = error.message;
  throw error;
} finally {
  if (output) { writeFileSync(join(output, 'router-verification.json'), `${JSON.stringify(report, null, 2)}\n`); }
  rmSync(temporary, { recursive: true, force: true });
}
