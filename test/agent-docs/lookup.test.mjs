import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const hash = value => createHash('sha256').update(value).digest('hex');

async function fixture(t) {
  const temporary = await realpath(await mkdtemp(resolve(tmpdir(), 'marionette-agent-docs-')));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const app = resolve(temporary, 'app');
  const packageRoot = resolve(app, 'node_modules/marionette');
  const docs = packageRoot;
  const skill = resolve(app, '.agents/skills/marionette');
  await mkdir(resolve(docs, 'docs'), { recursive: true });
  await mkdir(resolve(app, 'src/feature'), { recursive: true });
  await writeFile(resolve(packageRoot, 'package.json'), JSON.stringify({ name: 'marionette', version: '5.0.0-alpha.2' }));
  const content = '# Routing\nA router owns URL and history.\n';
  await writeFile(resolve(docs, 'docs/routing.md'), content);
  const page = { source: 'docs/routing.md', title: 'Routing', section: 'Guide', sha256: hash(content) };
  const manifest = {
    schemaVersion: 1, packageName: 'marionette', packageVersion: '5.0.0-alpha.2',
    sourceRevision: 'a'.repeat(40), sourceDirty: true,
    contentSha256: hash(`${page.source}\0${page.sha256}\n`), pages: [page], assets: [],
  };
  const save = () => writeFile(resolve(docs, 'docs-manifest.json'), JSON.stringify(manifest));
  await save();
  await cp(resolve(repository, 'skills/marionette'), skill, { recursive: true });
  const run = (...args) => spawnSync(process.execPath, [resolve(skill, 'scripts/docs.mjs'), ...args], {
    cwd: resolve(app, 'src/feature'), encoding: 'utf8',
  });
  return { temporary, app, packageRoot, docs, skill, content, manifest, save, run };
}

test('copied skill finds hoisted docs from a nested application directory and prints exact content/provenance', async t => {
  const data = await fixture(t);
  const listed = data.run('--list');
  assert.equal(listed.status, 0, listed.stderr);
  const index = JSON.parse(listed.stdout);
  assert.equal(index.packageRoot, data.packageRoot);
  assert.equal(index.sourceDirty, true);
  assert.equal(index.pages[0].path, resolve(data.docs, 'docs/routing.md'));
  const read = data.run('--page', index.pages[0].source);
  assert.equal(read.status, 0, read.stderr);
  assert.equal(read.stdout.slice(read.stdout.indexOf('\n') + 1), `${data.content}\n`);
  assert.equal(JSON.parse(read.stdout.split('\n')[0]).sourceRevision, 'a'.repeat(40));
});

test('explicit package root supports external package stores without importing package code', async t => {
  const data = await fixture(t);
  const stored = resolve(data.temporary, 'store/marionette');
  await cp(data.packageRoot, stored, { recursive: true });
  await rm(data.packageRoot, { recursive: true });
  await writeFile(resolve(stored, 'package.json'), JSON.stringify({ name: 'marionette', version: '5.0.0-alpha.2', main: 'explode.mjs' }));
  await writeFile(resolve(stored, 'explode.mjs'), 'throw new Error("Do not execute package code");');
  assert.equal(data.run('--package-root', stored).status, 0);
  assert.equal(data.run().status, 1);
  await symlink(stored, data.packageRoot, 'dir');
  assert.equal(data.run().status, 0);
});

test('nearest workspace dependency wins over another installed version', async t => {
  const data = await fixture(t);
  const nearer = resolve(data.app, 'src/node_modules/marionette');
  await cp(data.packageRoot, nearer, { recursive: true });
  const result = data.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).packageRoot, nearer);
});

test('missing packaged docs fails with an explicit source requirement', async t => {
  const data = await fixture(t);
  await rm(resolve(data.packageRoot, 'docs-manifest.json'));
  const result = data.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /exact release or known source revision/);
  assert.equal(result.stdout, '');
});

test('version mismatch and modified document content are rejected', async t => {
  const data = await fixture(t);
  data.manifest.packageVersion = '4.1.3';
  await data.save();
  assert.match(data.run().stderr, /does not match/);
  data.manifest.packageVersion = '5.0.0-alpha.2';
  await data.save();
  await writeFile(resolve(data.docs, 'docs/routing.md'), 'changed content');
  const result = data.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /hash mismatch/);
});

test('path traversal and document symlinks outside the snapshot are rejected', async t => {
  const data = await fixture(t);
  data.manifest.pages[0].source = '../outside.md';
  await data.save();
  assert.match(data.run().stderr, /Unsafe/);
  data.manifest.pages[0].source = 'C:docs/routing.md';
  await data.save();
  assert.match(data.run().stderr, /Unsafe/);
  data.manifest.pages[0].source = 'docs/routing.md';
  await data.save();
  const outside = resolve(data.temporary, 'outside.md');
  await writeFile(outside, data.content);
  await rm(resolve(data.docs, 'docs/routing.md'));
  await symlink(outside, resolve(data.docs, 'docs/routing.md'));
  assert.match(data.run().stderr, /escapes/);
});

test('manifest symlinks outside the snapshot are rejected before reading', async t => {
  const data = await fixture(t);
  const outside = resolve(data.temporary, 'external-manifest.json');
  await writeFile(outside, JSON.stringify(data.manifest));
  await rm(resolve(data.docs, 'docs-manifest.json'));
  await symlink(outside, resolve(data.docs, 'docs-manifest.json'));
  const result = data.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Documentation manifest escapes its package/);
});

test('manifest content digest is checked independently of page hashes', async t => {
  const data = await fixture(t);
  data.manifest.contentSha256 = '0'.repeat(64);
  await data.save();
  const result = data.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /content digest/);
});

test('unknown pages and ambiguous arguments fail without changing package files', async t => {
  const data = await fixture(t);
  assert.match(data.run('--page', 'docs/missing.md').stderr, /not in this package/);
  for (const args of [['--page'], ['--list', '--page', 'docs/routing.md'], ['--unknown']]) {
    assert.equal(data.run(...args).status, 1);
  }
  assert.equal(await readFile(resolve(data.docs, 'docs/routing.md'), 'utf8'), data.content);
});

test('a documentation directory symlink cannot escape the installed package', async t => {
  const data = await fixture(t);
  const outside = resolve(data.temporary, 'external-docs');
  const directory = resolve(data.packageRoot, 'docs');
  await cp(directory, outside, { recursive: true });
  await rm(directory, { recursive: true });
  await symlink(outside, directory, 'dir');
  const result = data.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Documentation source escapes its package/);
});

test('a document symlink to the package root is rejected before reading', async t => {
  const data = await fixture(t);
  const document = resolve(data.packageRoot, 'docs/routing.md');
  await rm(document);
  await symlink(data.packageRoot, document, 'dir');
  const result = data.run('--page', 'docs/routing.md');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Documentation source escapes its package: docs\/routing\.md/);
  assert.equal(result.stdout, '');
});

async function sectionFixture(t, content = '# UI\n\n## `getUI(name)`\nRead bound elements after rendering.\n\n### Results\nA NodeList, not one element.\n\n## Cleanup\nDestroy the owner.\n', assets = () => ({})) {
  const data = await fixture(t);
  const { documentSections } = await import('../../scripts/docs/sections.mjs');
  await writeFile(resolve(data.docs, 'docs/routing.md'), content);
  data.manifest.pages[0].sha256 = hash(content);
  const sections = documentSections('docs/routing.md', content);
  const files = { 'docs-sections.json': JSON.stringify({ schemaVersion: 1, sections }), ...assets(sections) };
  for (const [source, bytes] of Object.entries(files)) {
    await writeFile(resolve(data.docs, source), bytes);
    data.manifest.assets.push({ source, sha256: hash(bytes) });
  }
  data.rehash = () => {
    data.manifest.contentSha256 = hash([...data.manifest.pages, ...data.manifest.assets]
      .sort((a, b) => a.source.localeCompare(b.source, 'en'))
      .map(entry => `${entry.source}\0${entry.sha256}\n`).join(''));
    return data.save();
  };
  await data.rehash();
  return { ...data, content };
}

test('search and section lookup preserve provenance and read complete nested sections', async t => {
  const data = await sectionFixture(t);
  const search = data.run('--search', 'getUI');
  assert.equal(search.status, 0, search.stderr);
  const result = JSON.parse(search.stdout);
  assert.equal(result.sourceRevision, data.manifest.sourceRevision);
  assert.equal(result.results[0].heading, 'getUI(name)');
  assert.deepEqual(result.results[0].ancestors, ['UI']);
  assert.deepEqual(result.results[0].matchedTerms, ['getui']);
  const read = data.run('--section', result.results[0].id);
  assert.equal(read.status, 0, read.stderr);
  const [metadata, ...body] = read.stdout.split('\n');
  assert.equal(JSON.parse(metadata).contentSha256, data.manifest.contentSha256);
  assert.equal(body.join('\n'), data.content.slice(data.content.indexOf('## `getUI'), data.content.indexOf('## Cleanup')) + '\n');
  assert.deepEqual(JSON.parse(data.run('--search', 'nonexistent-symbol').stdout).results, []);
});

test('focused lookup rejects unknown IDs, ambiguous modes, missing and tampered indexes', async t => {
  const old = await fixture(t);
  assert.match(old.run('--search', 'routing').stderr, /no section index/);
  assert.equal(old.run('--page', 'docs/routing.md').status, 0);
  const data = await sectionFixture(t);
  assert.match(data.run('--section', 'docs/routing.md#missing').stderr, /Unknown section ID/);
  for (const args of [['--search'], ['--search', ' '], ['--search', 'x'.repeat(201)],
    ['--search', 'getUI', '--list'], ['--section', 'x', '--page', 'docs/routing.md']]) {
    assert.equal(data.run(...args).status, 1);
  }
  await writeFile(resolve(data.docs, 'docs-sections.json'), '{}');
  const result = data.run('--search', 'getUI');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /hash mismatch/);
  assert.equal(result.stdout, '');
});

const regionPage = '# Region\n\n## Index\n* [`detachView`](#detachview)\n\n## Region ownership\nA Region owns one View.\n\n## Detaching Existing Views\nCall `region.detachView()` to take the View back.\n\n### Events\n`before:detachView` fires first.\n\n## `detachView()`\nReturns the detached View.\n';
const regionInventory = { entrypoints: [{ name: 'marionette', exports: [
  { name: 'Region', kind: 'value', signature: 'RegionConstructor', contracts: ['region'],
    members: { extend: '() => RegionConstructor' }, instance: { detachView: '() => View | undefined', show: '(view: View) => this' },
    operationContracts: { instance: { detachView: ['region'] } } },
  { name: 'RegionInstance', kind: 'type', signature: 'RegionInstance', contracts: ['region'], instance: { detachView: '() => View' } },
] }] };
const regionSemantics = { contracts: [{ id: 'region', docs: [{ file: 'docs/routing.md', heading: 'Region ownership' }], diagnostics: ['MN0003'] }] };

async function symbolFixture(t) {
  const { symbolIndex } = await import('../../scripts/docs/symbols.mjs');
  return sectionFixture(t, regionPage, sections => ({
    'docs-symbols.json': JSON.stringify(symbolIndex(regionInventory, regionSemantics, sections)),
  }));
}

test('symbol lookup returns exact export signatures, members and reviewed contract sections with provenance', async t => {
  const data = await symbolFixture(t);
  const result = data.run('--symbol', 'Region');
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.contentSha256, data.manifest.contentSha256);
  assert.deepEqual(output.matches.map(match => [match.name, match.kind, match.signature]),
    [['Region', 'value', 'RegionConstructor']]);
  assert.deepEqual(output.matches[0].staticMembers, ['extend']);
  assert.deepEqual(output.matches[0].instanceMembers, ['detachView', 'show']);
  assert.deepEqual(output.contracts.region.diagnostics, ['MN0003']);
  assert.deepEqual(output.contracts.region.sections.map(section => [section.heading, section.ancestors]),
    [['Region ownership', ['Region']]]);
  const section = data.run('--section', output.contracts.region.sections[0].id);
  assert.match(section.stdout, /A Region owns one View\./);
});

test('member lookup names the sections that use it, most specific and named headings first', async t => {
  const data = await symbolFixture(t);
  const qualified = JSON.parse(data.run('--symbol', 'Region.detachView').stdout);
  const bare = JSON.parse(data.run('--symbol', 'detachView').stdout);
  assert.deepEqual(bare.matches, qualified.matches, 'type-only exports do not repeat runtime members');
  const [match] = qualified.matches;
  assert.equal(match.access, 'instance');
  assert.equal(match.signature, '() => View | undefined');
  assert.deepEqual(match.sections.map(section => section.heading), ['detachView()', 'Detaching Existing Views']);
  assert.equal(match.omittedSections, 0);
  const inherited = JSON.parse(data.run('--symbol', 'Region.show').stdout).matches[0];
  assert.deepEqual(inherited.contracts, ['region']);
  assert.deepEqual(inherited.sections, [], 'a member absent from code examples has no mention');
  assert.deepEqual(JSON.parse(data.run('--symbol', 'RegionInstance.detachView').stdout).matches, []);
});

test('symbol lookup reports absent names honestly and rejects malformed queries and indexes', async t => {
  const data = await symbolFixture(t);
  for (const query of ['Missing', 'Region.missing', 'constructor', 'Region.constructor']) {
    const result = data.run('--symbol', query);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).matches, [], query);
  }
  for (const query of ['Region.detachView.x', 'region view', '1Region']) {
    const result = data.run('--symbol', query);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /export name, Export\.member, or member name/);
  }
  assert.match((await sectionFixture(t)).run('--symbol', 'Region').stderr, /no symbol index/);
  const symbols = resolve(data.docs, 'docs-symbols.json');
  await writeFile(symbols, '{}');
  assert.match(data.run('--symbol', 'Region').stderr, /hash mismatch/);
  for (const [bytes, error] of [['{}', /Unsupported documentation symbol index/],
    [JSON.stringify({ schemaVersion: 1, contracts: {}, symbols: [{ entrypoint: 'marionette', name: 'Region', signature: 'x', contracts: ['region'] }] }), /Invalid documentation symbol index/],
    [JSON.stringify({ schemaVersion: 1, contracts: { region: { sections: ['docs/routing.md#L99'], diagnostics: [] } }, symbols: [] }), /Invalid documentation symbol index/]]) {
    await writeFile(symbols, bytes);
    data.manifest.assets.find(asset => asset.source === 'docs-symbols.json').sha256 = hash(bytes);
    await data.rehash();
    const result = data.run('--symbol', 'Region');
    assert.equal(result.status, 1);
    assert.match(result.stderr, error);
    assert.equal(result.stdout, '');
  }
});
