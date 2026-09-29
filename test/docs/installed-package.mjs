import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { releasePackages } from '../../scripts/release/packages.mjs';

// Verify the normal staged package, not a separate documentation-only candidate.
// Run after docs:package and the package builds. No registry Marionette is used.
const root = resolve(import.meta.dirname, '../..');
const directory = realpathSync(mkdtempSync(join(tmpdir(), 'marionette-installed-docs-')));
const artifacts = join(directory, 'artifacts');
mkdirSync(artifacts);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const run = (command, args, cwd = directory) => execFileSync(command, args, {
  cwd, encoding: 'utf8', timeout: 120_000,
  env: { ...process.env, NODE_PATH: '', NODE_OPTIONS: '--no-global-search-paths' },
});
const npm = args => run(process.execPath, [process.env.npm_execpath, ...args]);
const report = { passed: false };

try {
  assert(process.env.npm_execpath, 'Run through npm run check:docs-installed');
  const packs = releasePackages.map(entry => {
    const source = entry.id === 'core' ? '.package' : entry.directory;
    const [packed] = JSON.parse(npm(['pack', join(root, source), '--ignore-scripts', '--json', '--pack-destination', artifacts]));
    assert.equal(packed.name, entry.name);
    return { name: packed.name, filename: packed.filename,
      sha256: hash(readFileSync(join(artifacts, packed.filename))), files: packed.files.map(file => file.path) };
  });
  const core = packs.find(pack => pack.name === 'marionette');
  assert(!core.files.some(path => /^(starter|planning|benchmarks|test)\//.test(path)));
  for (const path of ['docs/agents.md', 'docs/packages/data.md', 'skills/marionette/SKILL.md']) {
    assert(core.files.includes(path), `Missing packaged entrypoint: ${path}`);
  }
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ name: 'installed-docs-check', private: true, type: 'module' }));
  npm(['install', '--ignore-scripts', '--no-audit', '--no-fund',
    ...packs.map(pack => join(artifacts, pack.filename)), 'lit-html@3.3.3']);

  const packageJson = run(process.execPath, ['-p', 'require.resolve(\'marionette/package.json\')']).trim();
  const packageRoot = join(directory, 'node_modules/marionette');
  assert.equal(packageJson, join(packageRoot, 'package.json'));
  const helper = join(packageRoot, 'skills/marionette/scripts/docs.mjs');
  const lookup = args => run(process.execPath, [helper, ...args]);
  const listed = JSON.parse(lookup(['--list']));
  const searched = JSON.parse(lookup(['--search', 'prepareStart']));
  assert(listed.pages.some(page => page.source === 'docs/packages/data.md'));
  const match = searched.results.find(result => result.source === 'docs/api/application.md');
  assert(match, 'Search did not find the Application contract');
  const section = lookup(['--section', match.id]);
  assert(section.includes('prepareStart'));
  assert(lookup(['--page', 'docs/packages/data.md']).includes('Membership and ordering'));
  assert.equal(JSON.parse(lookup(['--diagnostic', 'MN0003'])).diagnostic.code, 'MN0003');

  run(process.execPath, [join(root, 'test/docs/reference-examples.mjs'), directory]);
  const examples = JSON.parse(readFileSync(join(directory, 'reference-examples/report.json')));
  assert(examples.passed);
  const manifest = JSON.parse(readFileSync(join(packageRoot, 'docs-manifest.json')));
  for (const item of [...manifest.pages, ...manifest.assets]) {
    assert.equal(hash(readFileSync(join(packageRoot, item.source))), item.sha256, item.source);
  }
  Object.assign(report, {
    passed: true, sourceRevision: manifest.sourceRevision, sourceDirty: manifest.sourceDirty,
    contentSha256: manifest.contentSha256, pages: manifest.pages.length, assets: manifest.assets.length,
    packages: packs.map(({ files, ...pack }) => pack),
    discovery: ['package resolution', 'list', 'search', 'section', 'page', 'diagnostic'],
    examplesExecuted: examples.examples.filter(example => example.executed).length,
    typeFixtures: examples.typescript.contractFixtures, typescriptExamples: examples.typescript.examples,
    limits: 'Local tarballs and JSDOM; not registry publication, live website, browser interaction, or teaching effectiveness.',
  });
} catch (error) {
  report.error = String(error.stack || error);
  process.exitCode = 1;
} finally {
  const output = join(root, 'test/tmp/docs-installed');
  mkdirSync(output, { recursive: true });
  writeFileSync(join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  rmSync(directory, { recursive: true, force: true });
  console.log(JSON.stringify(report, null, 2));
}
