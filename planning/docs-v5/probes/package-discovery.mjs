import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  readdirSync, realpathSync, renameSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';

// A local candidate artifact probe. It does not change production packaging or publish.
const root = resolve(import.meta.dirname, '../../..');
const output = join(root, 'test/tmp/docs-v5-package');
const docs = files(join(root, 'docs')).filter(path => path.endsWith('.md')).map(path => `docs/${path}`);
const packageRoots = ['', 'packages/utils', 'packages/radio', 'packages/data', 'packages/adapters'];
const env = {
  ...process.env, NODE_PATH: '', NODE_OPTIONS: '--no-global-search-paths',
  PATH: process.env.PATH.split(':').filter(path => !path.includes('/node_modules/.bin')).join(':'),
  'npm_config_ignore_scripts': 'true', PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1',
};
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const report = { schemaVersion: 1, kind: 'local-candidate-package-probe', startedAt: new Date().toISOString(), commands: [], passed: false };

function files(path) {
  return readdirSync(path, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile()).map(entry => relative(path, join(entry.parentPath, entry.name))).sort();
}
function writeJson(path, data) { writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`); }
function run(command, args, cwd, label) {
  const log = join(output, `${String(report.commands.length + 1).padStart(2, '0')}-${label}.log`);
  const entry = { command, args, cwd, log, startedAt: new Date().toISOString() };
  report.commands.push(entry);
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 300_000 });
  writeFileSync(log, `${result.stdout || ''}\n${result.stderr || ''}`);
  entry.exitCode = result.status ?? -1;
  assert.equal(entry.exitCode, 0, `Command failed (${label}); see ${log}: ${result.error || result.stderr?.slice(-1000) || ''}`);
  return result.stdout;
}
function copy(source, destination) {
  assert(existsSync(source), `Required file missing: ${source}`);
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true });
}
function exportTargets(value) {
  return typeof value === 'string' ? [value] : Object.values(value).flatMap(exportTargets);
}
function lockEntry(manifest, packed) {
  const entry = { version: manifest.version, resolved: `file:tarballs/${packed.filename}`, integrity: packed.integrity };
  for (const key of ['dependencies', 'peerDependencies', 'peerDependenciesMeta', 'engines', 'license']) {
    if (manifest[key]) { entry[key] = manifest[key]; }
  }
  return entry;
}
function assertNoAncestorModules(consumer) {
  for (let parent = dirname(consumer); ; parent = dirname(parent)) {
    assert(!existsSync(join(parent, 'node_modules')), `Consumer has ancestor node_modules: ${parent}`);
    if (parent === dirname(parent)) { break; }
  }
}

function assertNoBackbone(project, label) {
  const installedLock = json(join(project, 'package-lock.json'));
  assert(!Object.keys(installedLock.packages).some(path => /(^|\/)node_modules\/backbone(?:\/|$)/.test(path)), `${label} lock unexpectedly includes Backbone`);
  run(process.execPath, ['--input-type=module', '-e', 'import assert from \'node:assert/strict\'; import { createRequire } from \'node:module\'; const require = createRequire(import.meta.url); assert.throws(() => require.resolve(\'backbone\'), { code: \'MODULE_NOT_FOUND\' });'], project, `${label}-no-backbone`);
}

function headingAnchors(markdown) {
  const counts = new Map();
  return new Set([...markdown.replace(/```[\s\S]*?```/g, '').matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)].map(([, heading]) => {
    const slug = heading.toLowerCase().replace(/[^\p{L}\p{N}_\- ]/gu, '').replaceAll(' ', '-');
    const count = counts.get(slug) || 0;
    counts.set(slug, count + 1);
    return count ? `${slug}-${count}` : slug;
  }));
}

function discover(installedCore) {
  const visited = new Set();
  const queue = ['readme.md', 'llms.txt'];
  const links = [];
  while (queue.length) {
    const path = queue.shift();
    if (visited.has(path)) { continue; }
    visited.add(path);
    const contents = readFileSync(join(installedCore, path), 'utf8');
    for (const match of contents.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const link = match[1].replace(/^<|>$/g, '');
      if (/^[a-z]+:/i.test(link)) { continue; }
      const [target, anchor] = link.split('#');
      const destination = target ? resolve(installedCore, dirname(path), target) : resolve(installedCore, path);
      assert(destination.startsWith(installedCore + sep), `Local link escapes package: ${path}: ${target}`);
      assert(existsSync(destination), `Broken installed link: ${path}: ${target}`);
      if (anchor && destination.endsWith('.md')) {
        assert(headingAnchors(readFileSync(destination, 'utf8')).has(decodeURIComponent(anchor)), `Broken installed anchor: ${path}: ${link}`);
      }
      const relativeTarget = relative(installedCore, destination);
      links.push({ from: path, to: relativeTarget, ...(anchor ? { anchor } : {}) });
      if (/\.(md|txt)$/.test(relativeTarget)) { queue.push(relativeTarget); }
    }
  }
  for (const path of docs) { assert(visited.has(path), `Documentation not discoverable from installed readme/llms: ${path}`); }
  return { entrypoints: ['readme.md', 'llms.txt'], visited: [...visited].sort(), links };
}

mkdirSync(output, { recursive: true });
try {
  const publicFiles = ['readme.md', 'llms.txt', ...docs];
  for (const path of publicFiles) { assert(existsSync(join(root, path)), `Expected new documentation missing: ${path}`); }
  report.provenance = {
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    status: execFileSync('git', ['status', '--porcelain=v1'], { cwd: root, encoding: 'utf8' }).trimEnd(),
    stagedDiffSha256: createHash('sha256').update(execFileSync('git', ['diff', '--cached', '--binary'], { cwd: root })).digest('hex'),
    unstagedDiffSha256: createHash('sha256').update(execFileSync('git', ['diff', '--binary'], { cwd: root })).digest('hex'),
    probeSha256: hash(import.meta.filename), node: process.version,
    npm: execFileSync('npm', ['--version'], { cwd: root, encoding: 'utf8' }).trim(),
    note: 'Dirty working-tree candidate. Untracked public files are identified by content hashes below. No registry release or production packaging claim.',
  };
  run(process.execPath, ['examples/records/scripts/build-local-packages.mjs'], root, 'build-runtime');
  const candidate = realpathSync(mkdtempSync(join(tmpdir(), 'marionette-docs-package-')));
  report.candidateDirectory = candidate;
  const consumer = join(candidate, 'consumer');
  mkdirSync(consumer);
  assertNoAncestorModules(consumer);
  report.consumer = { directory: consumer, nodePath: env.NODE_PATH, nodeOptions: env.NODE_OPTIONS, inheritedBinPathsRemoved: true, ancestorNodeModules: false };
  report.transforms = { packageManifests: 'Remove repository scripts, devDependencies, workspaces, overrides, allowScripts; replace files allowlist. Preserve versions, exports, runtime dependencies and peer constraints.', exampleSources: 'Unmodified src/public/index.html/vite.config.js from installed package.', consumerConfig: 'Local tarball dependencies and frozen third-party lock overlay; browser harness uses ports 5197/5198 and copied repository tests.' };
  mkdirSync(join(consumer, 'tarballs'));
  const packedPackages = [];
  for (const packageRoot of packageRoots) {
    const source = join(root, packageRoot);
    const original = json(join(source, 'package.json'));
    const stage = join(candidate, 'staging', original.name.replaceAll('/', '-'));
    mkdirSync(stage, { recursive: true });
    const runtime = new Set(exportTargets(original.exports).filter(path => path !== './package.json'));
    for (const key of ['main', 'module', 'browser', 'types']) { if (original[key]) { runtime.add(original[key]); } }
    // Companion dist trees contain runtime and declarations only. Core dist also
    // contains retired generated docs, so select its public files explicitly.
    if (packageRoot) {
      copy(join(source, 'dist'), join(stage, 'dist'));
    } else {
      copy(join(source, 'dist/types'), join(stage, 'dist/types'));
      for (const path of runtime) {
        copy(join(source, path), join(stage, path));
        if (existsSync(join(source, `${path}.map`))) { copy(join(source, `${path}.map`), join(stage, `${path}.map`)); }
      }
    }
    for (const path of runtime) { assert(existsSync(join(stage, path)), `Missing public export: ${original.name}/${path}`); }
    copy(join(source, 'readme.md'), join(stage, 'readme.md'));
    copy(join(root, 'license.txt'), join(stage, 'license.txt'));
    const manifest = { ...original };
    // Candidate artifacts have no repository build lifecycle or workspace links.
    for (const key of ['scripts', 'devDependencies', 'workspaces', 'overrides', 'allowScripts']) { delete manifest[key]; }
    manifest.files = ['dist/', 'readme.md', 'license.txt'];
    if (!packageRoot) {
      for (const path of publicFiles) { copy(join(root, path), join(stage, path)); }
      for (const path of ['src', 'public', 'index.html', 'vite.config.js', 'README.md']) {
        copy(join(root, 'examples/records', path), join(stage, 'examples/records', path));
      }
      manifest.files.push('docs/', 'llms.txt', 'examples/records/', 'candidate-provenance.json');
    }
    writeJson(join(stage, 'package.json'), manifest);
    const stagedFiles = Object.fromEntries(files(stage).map(path => [path, hash(join(stage, path))]));
    if (!packageRoot) {
      writeJson(join(stage, 'candidate-provenance.json'), { ...report.provenance, files: stagedFiles });
    }
    const packed = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', join(consumer, 'tarballs')], stage, `pack-${original.name.replaceAll('/', '-')}`))[0];
    const packedNames = packed.files.map(file => file.path);
    assert(!packedNames.some(path => /(^|\/)(planning|test|tests|node_modules|agent-skill)(\/|$)/.test(path)), 'Forbidden evaluator/generated files shipped');
    if (!packageRoot) {
      assert.deepEqual(packedNames.filter(path => path.startsWith('docs/')).sort(), docs.slice().sort());
      assert(!packedNames.some(path => path.startsWith('dist/') && !path.startsWith('dist/types/') && ![...runtime].some(target => path === target.replace(/^\.\//, '') || path === `${target.replace(/^\.\//, '')}.map`)), 'Unexpected core dist file shipped');
    }
    packedPackages.push({ original, manifest, packed, stage, stagedFiles });
  }
  report.packages = packedPackages.map(({ manifest, packed, stagedFiles }) => ({
    name: manifest.name, version: manifest.version, filename: packed.filename,
    sha256: hash(join(consumer, 'tarballs', packed.filename)), integrity: packed.integrity,
    exports: manifest.exports, dependencies: manifest.dependencies || {}, files: stagedFiles,
  }));
  const exampleLock = json(join(root, 'examples/records/package-lock.json'));
  const rootLock = json(join(root, 'package-lock.json'));
  const consumerManifest = {
    name: 'marionette-docs-installed-consumer', private: true, version: '0.0.0', type: 'module',
    scripts: { dev: 'vite', build: 'vite build' },
    dependencies: { 'lit-html': exampleLock.packages[''].dependencies['lit-html'] },
    devDependencies: { vite: exampleLock.packages[''].devDependencies.vite, '@playwright/test': rootLock.packages['node_modules/@playwright/test'].version },
  };
  const lock = { name: consumerManifest.name, version: consumerManifest.version, lockfileVersion: 3, requires: true, packages: {} };
  for (const [path, entry] of Object.entries(exampleLock.packages)) {
    if (path.startsWith('node_modules/') && !entry.link) { lock.packages[path] = entry; }
  }
  for (const name of ['@playwright/test', 'playwright', 'playwright-core']) {
    lock.packages[`node_modules/${name}`] = rootLock.packages[`node_modules/${name}`];
  }
  for (const { manifest, packed } of packedPackages) {
    consumerManifest.dependencies[manifest.name] = `file:tarballs/${packed.filename}`;
    lock.packages[`node_modules/${manifest.name}`] = lockEntry(manifest, packed);
  }
  lock.packages[''] = { ...consumerManifest };
  delete lock.packages[''].scripts;
  delete lock.packages[''].private;
  delete lock.packages[''].type;
  writeJson(join(consumer, 'package.json'), consumerManifest);
  writeJson(join(consumer, 'package-lock.json'), lock);
  const lockHash = hash(join(consumer, 'package-lock.json'));
  report.lock = { sourceExampleSha256: hash(join(root, 'examples/records/package-lock.json')), sourceRootSha256: hash(join(root, 'package-lock.json')), consumerSha256: lockHash, note: 'Exact registry lock entries retained; only local framework tarballs and the existing root Playwright dependency closure are overlaid.' };
  run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], consumer, 'install');
  assert.equal(hash(join(consumer, 'package-lock.json')), lockHash, 'npm ci changed the frozen consumer lock');
  assertNoBackbone(consumer, 'consumer');
  report.consumer.backboneAbsent = true;
  for (const { manifest, stagedFiles } of packedPackages) {
    const installed = join(consumer, 'node_modules', manifest.name);
    assert(!lstatSync(installed).isSymbolicLink(), 'Installed package is a workspace symlink');
    assert(realpathSync(installed).startsWith(realpathSync(consumer) + sep));
    assert.equal(json(join(installed, 'package.json')).version, manifest.version);
    for (const [path, sha256] of Object.entries(stagedFiles)) { assert.equal(hash(join(installed, path)), sha256, `Installed content mismatch: ${manifest.name}/${path}`); }
  }
  const installedCore = join(consumer, 'node_modules/marionette');
  const installedVersion = json(join(installedCore, 'package.json')).version;
  report.documentationVersions = {};
  for (const path of ['docs/readme.md', 'docs/quick-start.md', 'docs/api.md']) {
    const declaration = readFileSync(join(installedCore, path), 'utf8').split('\n').find(line => /(?:target|reference covers)/.test(line));
    const version = declaration?.match(/\d+\.\d+\.\d+(?:-[a-z0-9.]+)?/i)?.[0];
    assert.equal(version, installedVersion, `Documentation version does not match installed package: ${path}`);
    report.documentationVersions[path] = version;
  }

  const resolvedPackage = run(process.execPath, ['-p', 'require.resolve(\'marionette/package.json\')'], consumer, 'resolve-package').trim();
  assert.equal(resolvedPackage, join(installedCore, 'package.json'));
  report.discovery = { ...discover(installedCore), scope: 'core package docs only', resolvedPackage };
  const apiPath = join(installedCore, 'docs/api.md');
  const hiddenApiPath = join(installedCore, 'docs/api.md.discovery-negative');
  renameSync(apiPath, hiddenApiPath);
  try {
    assert.throws(() => discover(installedCore), /Broken installed link: .*api\.md/, 'Missing linked API doc was not rejected for the intended reason');
    report.discovery.negativeCheck = 'Removed linked docs/api.md; traversal rejected the missing path. Original file restored.';
  } finally { renameSync(hiddenApiPath, apiPath); }
  assert.equal(hash(apiPath), report.packages.find(item => item.name === 'marionette').files['docs/api.md']);
  const commonPath = join(installedCore, 'docs/api/shared/common.md');
  const commonMarkdown = readFileSync(commonPath, 'utf8');
  assert(commonMarkdown.includes('## Binding helpers'), 'Expected shared reference heading missing');
  writeFileSync(commonPath, commonMarkdown.replace('## Binding helpers', '## Removed heading for discovery check'));
  try {
    assert.throws(() => discover(installedCore), /Broken installed anchor: .*common\.md#binding-helpers/);
    report.discovery.anchorNegativeCheck = 'Removed linked binding-helpers heading; traversal rejected the stale anchor. Original file restored.';
  } finally { writeFileSync(commonPath, commonMarkdown); }
  run(process.execPath, [join(root, 'planning/docs-v5/probes/reference-examples.mjs'), consumer], consumer, 'reference-examples');
  report.referenceExamples = json(join(consumer, 'reference-examples/report.json'));
  writeFileSync(join(consumer, 'verify-imports.mjs'), 'import assert from \'node:assert/strict\';\nimport { createRequire } from \'node:module\';\nconst require = createRequire(import.meta.url);\nfor (const name of [\'marionette\', \'@mnjs/utils\', \'@mnjs/radio\', \'@mnjs/data\', \'@mnjs/adapters/dom/lit-html\', \'marionette/eslint\']) {\n const resolved = require.resolve(name);\n assert(resolved.startsWith(process.cwd() + \'/node_modules/\'));\n const esm = await import(name); const cjs = require(name);\n assert(Object.keys(esm).length); assert(cjs);\n console.log(JSON.stringify({ name, resolved, esm: Object.keys(esm), commonjs: typeof cjs }));\n}\n');
  report.imports = run(process.execPath, ['verify-imports.mjs'], consumer, 'public-imports').trim().split('\n').map(line => JSON.parse(line));
  for (const path of ['src', 'public', 'index.html', 'vite.config.js']) { copy(join(installedCore, 'examples/records', path), join(consumer, path)); }
  run('npm', ['run', 'build'], consumer, 'consumer-build');
  copy(join(root, 'examples/records/tests/records.spec.js'), join(consumer, 'tests/records.spec.js'));
  report.browserTestSha256 = hash(join(consumer, 'tests/records.spec.js'));
  writeFileSync(join(consumer, 'playwright.config.js'), 'import { defineConfig, devices } from \'@playwright/test\';\nexport default defineConfig({\n testDir: \'./tests\', outputDir: \'./browser-results\', fullyParallel: true, retries: 0,\n reporter: [[\'list\'], [\'json\', { outputFile: \'./browser-report.json\' }]],\n use: { baseURL: \'http://127.0.0.1:5197\' },\n projects: [\n  { name: \'chromium\', use: devices[\'Desktop Chrome\'] },\n  { name: \'firefox\', use: devices[\'Desktop Firefox\'] },\n  { name: \'webkit\', use: devices[\'Desktop Safari\'] },\n ],\n webServer: { command: \'npm run dev -- --host 127.0.0.1 --port 5197\', url: \'http://127.0.0.1:5197\', reuseExistingServer: false, timeout: 120000 },\n});\n');
  run(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.config.js', '--workers=3'], consumer, 'consumer-browser');
  const browser = json(join(consumer, 'browser-report.json'));
  report.browser = browser.stats;
  assert.equal(browser.stats.unexpected, 0);
  assert.equal(browser.stats.flaky, 0);
  assert.equal(browser.stats.skipped, 0);
  assert(browser.stats.expected > 0);
  const quickstart = join(candidate, 'quick-start');
  mkdirSync(quickstart);
  const quickstartMarkdown = readFileSync(join(installedCore, 'docs/quick-start.md'), 'utf8');
  assertNoAncestorModules(quickstart);
  copy(join(consumer, 'tarballs'), join(quickstart, 'artifacts'));
  const installCommands = quickstartMarkdown.match(/```sh\n([\s\S]*?)```/)?.[1];
  assert.equal(installCommands?.trim(), [
    'npm init -y',
    'npm pkg set type=module scripts.dev="vite" scripts.build="vite build"',
    `npm install --ignore-scripts --save-exact ./artifacts/*.tgz lit-html@${consumerManifest.dependencies['lit-html']}`,
    `npm install --ignore-scripts --save-dev --save-exact vite@${consumerManifest.devDependencies.vite}`,
  ].join('\n'), 'Quick-start install commands changed; review the bootstrap probe before executing');
  writeFileSync(join(quickstart, 'install.sh'), installCommands);
  run('bash', ['-e', 'install.sh'], quickstart, 'quick-start-install');
  assertNoBackbone(quickstart, 'quick-start');
  assert(!existsSync(join(quickstart, 'node_modules/@playwright')), 'Browser harness must not be an app dependency');
  for (const { manifest, stagedFiles } of packedPackages) {
    const installed = join(quickstart, 'node_modules', manifest.name);
    assert(!lstatSync(installed).isSymbolicLink(), 'Quick-start package is a workspace symlink');
    assert.equal(json(join(installed, 'package.json')).version, manifest.version);
    for (const [path, sha256] of Object.entries(stagedFiles)) { assert.equal(hash(join(installed, path)), sha256, `Quick-start installed content mismatch: ${manifest.name}/${path}`); }
  }

  const extracted = {};
  for (const [language, filename] of [['html', 'index.html'], ['js', 'main.js']]) {
    const fences = [...quickstartMarkdown.matchAll(new RegExp('```' + language + '\\n([\\s\\S]*?)```', 'g'))];
    assert.equal(fences.length, 1, `Expected one ${language} quick-start fence`);
    writeFileSync(join(quickstart, filename), fences[0][1]);
    extracted[filename] = hash(join(quickstart, filename));
  }
  run('npm', ['run', 'build'], quickstart, 'quick-start-build');
  writeFileSync(join(consumer, 'tests/quick-start.spec.js'), 'import { expect, test } from \'@playwright/test\';\ntest(\'installed quick-start fences render without browser errors\', async ({ page }) => {\n const errors = []; page.on(\'pageerror\', error => errors.push(error.message));\n await page.goto(\'/\');\n await expect(page.getByRole(\'heading\', { name: \'Hello, Marionette\', exact: true })).toBeVisible();\n expect(errors).toEqual([]);\n});\n');
  writeFileSync(join(consumer, 'quick-start.config.js'), `import { defineConfig, devices } from '@playwright/test';\nexport default defineConfig({ testDir: './tests', testMatch: 'quick-start.spec.js', retries: 0, reporter: 'list', use: { baseURL: 'http://127.0.0.1:5198' }, projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }, { name: 'firefox', use: devices['Desktop Firefox'] }, { name: 'webkit', use: devices['Desktop Safari'] }], webServer: { cwd: ${JSON.stringify(quickstart)}, command: 'npm run dev -- --host 127.0.0.1 --port 5198 --strictPort', url: 'http://127.0.0.1:5198', reuseExistingServer: false } });\n`);
  run(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config', 'quick-start.config.js', '--workers=3'], consumer, 'quick-start-browser');
  report.quickstart = {
    source: 'installed docs/quick-start.md', directory: quickstart, extracted,
    installScriptSha256: hash(join(quickstart, 'install.sh')), installCommands,
    lockSha256: hash(join(quickstart, 'package-lock.json')), manifestSha256: hash(join(quickstart, 'package.json')),
    build: 'passed', browser: '3 passed', dependencyRoot: quickstart,
    backboneAbsent: true, ancestorNodeModules: false, playwrightInstalledInApp: false,
    note: 'Separate fresh bootstrap using documented commands and supplied tarballs. Third-party transitive dependencies resolved during this run; this is not the frozen dependency graph used by the main consumer. npm lifecycle scripts disabled by the probe environment.',
  };
  copy(join(quickstart, 'package-lock.json'), join(output, 'quick-start-package-lock.json'));
  copy(join(consumer, 'package-lock.json'), join(output, 'consumer-package-lock.json'));
  copy(join(consumer, 'browser-report.json'), join(output, 'browser-report.json'));
  report.consumer.generatedFiles = Object.fromEntries(['package.json', 'package-lock.json', 'playwright.config.js', 'quick-start.config.js', 'verify-imports.mjs'].map(path => [path, hash(join(consumer, path))]));
  report.passed = true;
  report.limitations = ['Candidate packaging only; production publisher pipeline remains unchanged.', 'Browser checks use the dev server; production bundling is checked separately.', 'Behavior and discovery do not measure independent-agent teaching effectiveness.'];
} catch (error) {
  report.error = String(error.stack || error);
  process.exitCode = 1;
} finally {
  report.completedAt = new Date().toISOString();
  writeJson(join(output, 'report.json'), report);
  console.log(JSON.stringify({ passed: report.passed, report: join(output, 'report.json'), consumer: report.consumer?.directory, error: report.error }, null, 2));
}
