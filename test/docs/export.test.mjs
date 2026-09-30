import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp } from 'node:fs/promises';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { posix, resolve } from 'node:path';
import test from 'node:test';
import { Marked } from 'marked';
import { contentDigest, exportDocs, readResources, sha256, validateNavigation } from '../../scripts/docs/export.mjs';
import { documentSections, isConsumerPage } from '../../scripts/docs/sections.mjs';
import { symbolIndex } from '../../scripts/docs/symbols.mjs';
import { findSymbols, validateSymbolIndex } from '../../skills/marionette/scripts/symbols.mjs';

const markdownParser = new Marked();

async function markdownTargets(contents) {
  const targets = [];
  const pending = markdownParser.walkTokens(markdownParser.lexer(contents), token => {
    if (token.type === 'link' || token.type === 'image') { targets.push(token.href); }
  });
  await Promise.all(pending);
  return targets;
}

function decodeTarget(source, target) {
  let decoded;
  try {
    decoded = decodeURIComponent(target.split(/[?#]/, 1)[0]);
  } catch {
    assert.fail(`${source} has malformed relative reference: ${target}`);
  }
  return decoded;
}

test('Markdown references ignore code examples and identify malformed URLs', async() => {
  const contents = `[real](./real.md)

\`\`\`markdown
[fenced](./fenced-example.md)
\`\`\`

    [indented](./indented-example.md)
`;
  assert.deepEqual(await markdownTargets(contents), ['./real.md']);
  assert.throws(() => decodeTarget('benchmarks/docs/README.md', './a%zz.md'),
    /benchmarks\/docs\/README\.md has malformed relative reference: \.\/a%zz\.md/);
});

test('export CLI labels stable and prerelease documentation from the selected policy', async() => {
  const directory = await mkdtemp(resolve(tmpdir(), 'marionette-doc-channel-'));
  try {
    for (const path of ['scripts/docs', 'scripts/release', 'docs-site', 'docs', 'config/diagnostics', 'config/api-contracts']) {
      await mkdir(resolve(directory, path), { recursive: true });
    }
    for (const path of ['scripts/docs/export.mjs', 'scripts/docs/sections.mjs', 'scripts/docs/headings.mjs', 'scripts/docs/symbols.mjs', 'scripts/release/publication.mjs', 'config/release-promotion.json']) {
      await cp(new URL(`../../${path}`, import.meta.url), resolve(directory, path));
    }
    await cp(new URL('../../node_modules/marked', import.meta.url), resolve(directory, 'node_modules/marked'), { recursive: true });
    const policyPath = resolve(directory, 'config/release-promotion.json');
    const policy = JSON.parse(await readFile(policyPath, 'utf8'));
    policy.npm.prereleaseTag = 'next';
    await writeFile(policyPath, JSON.stringify(policy));
    await writeFile(resolve(directory, 'docs/guide.md'), '# Guide\n');
    await writeFile(resolve(directory, 'config/diagnostics/catalog.json'), '{}');
    const semantics = JSON.stringify({ contracts: [] });
    await writeFile(resolve(directory, 'config/api-contracts/inventory.json'), JSON.stringify({ entrypoints: [], semanticsSha256: sha256(semantics) }));
    await writeFile(resolve(directory, 'config/api-contracts/semantics.json'), semantics);
    await writeFile(resolve(directory, 'docs-site/resources.json'), JSON.stringify(['config/diagnostics/catalog.json',
      'config/api-contracts/inventory.json', 'config/api-contracts/semantics.json']));
    await writeFile(resolve(directory, 'docs-site/navigation.json'), JSON.stringify([
      { source: 'docs/guide.md', route: 'docs/guide', title: 'Guide', section: 'Start' }
    ]));
    execFileSync('git', ['init', '-q'], { cwd: directory });
    execFileSync('git', ['-c', 'user.name=Docs tests', '-c', 'user.email=docs-tests@example.invalid',
      '-c', 'core.hooksPath=/dev/null', 'commit', '--allow-empty', '-qm', 'docs fixture'], { cwd: directory });
    for (const [version, channel] of [['5.0.0', 'latest'], ['5.0.0-beta.2', 'next']]) {
      await writeFile(resolve(directory, 'package.json'), JSON.stringify({ name: 'marionette', version }));
      execFileSync(process.execPath, ['scripts/docs/export.mjs'], { cwd: directory });
      const manifest = JSON.parse(await readFile(resolve(directory, '.docs-export/manifest.json'), 'utf8'));
      assert.equal(manifest.packageVersion, version);
      assert.equal(manifest.channel, channel);
    }
    await writeFile(resolve(directory, 'config/api-contracts/semantics.json'), JSON.stringify({ contracts: [], changed: true }));
    assert.throws(() => execFileSync(process.execPath, ['scripts/docs/export.mjs'], { cwd: directory, stdio: 'pipe' }),
      /Public contract inventory is stale/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejects unsafe paths and ambiguous source or route entries', () => {
  const valid = { source: 'docs/readme.md', route: 'docs', title: 'Docs', section: 'Start' };
  for (const source of ['../readme.md', 'docs/../readme.md', '/docs/readme.md']) {
    assert.throws(() => validateNavigation([{ ...valid, source }]));
  }
  assert.throws(() => validateNavigation([valid, { ...valid, route: 'docs/other' }]));
  assert.throws(() => validateNavigation([valid, { ...valid, source: 'docs/other.md' }]));
  assert.throws(() => validateNavigation([{ ...valid, route: 'docs/../escape' }]));
});

test('resources are explicit text files and cannot escape through paths or symlinks', async() => {
  const directory = await mkdtemp(resolve(tmpdir(), 'marionette-doc-resources-'));
  const repository = resolve(directory, 'repository');
  const outside = resolve(directory, 'outside');
  try {
    await mkdir(repository);
    await mkdir(outside);
    await writeFile(resolve(repository, 'guide.md'), 'Read this exact text.\n');
    await writeFile(resolve(repository, 'helper.js'), 'export const value = true;\n');
    await writeFile(resolve(repository, 'metadata.yaml'), 'enabled: true\n');
    await writeFile(resolve(repository, 'unlisted.md'), 'Do not export adjacent files.');
    await writeFile(resolve(outside, 'private.md'), 'Outside the repository.');
    const resources = await readResources(repository, ['guide.md']);
    assert.deepEqual(resources.map(entry => entry.source), ['guide.md']);
    assert.equal(resources[0].bytes.toString(), 'Read this exact text.\n');
    assert.equal((await readResources(repository, ['helper.js']))[0].bytes.toString(),
      'export const value = true;\n');
    assert.equal((await readResources(repository, ['metadata.yaml']))[0].bytes.toString(),
      'enabled: true\n');
    for (const source of ['../outside/private.md', '/guide.md', './guide.md', 'a/../guide.md',
      'a//guide.md', 'a\\guide.md', 'guide.txt', 'guide.md?query', 42, null]) {
      await assert.rejects(readResources(repository, [source]), /Invalid documentation resource/);
    }
    await assert.rejects(readResources(repository, []), /resources are empty/);
    await assert.rejects(readResources(repository, ['guide.md', 'guide.md']), /Duplicate/);
    await assert.rejects(readResources(repository, ['guide.md'], ['guide.md']), /Duplicate/);
    await symlink(outside, resolve(repository, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(readResources(repository, ['linked/private.md']), /escapes its repository/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('exports every current guide with exact bytes and reproducible provenance', async() => {
  const manifest = await exportDocs();
  const again = await exportDocs();
  assert.deepEqual(again, manifest);
  assert.match(manifest.sourceRevision, /^[a-f0-9]{40}$/);
  assert.equal(typeof manifest.sourceDirty, 'boolean');
  const resources = JSON.parse(await readFile(new URL('../../docs-site/resources.json', import.meta.url), 'utf8'));
  assert.deepEqual(manifest.assets.map(asset => asset.source), [...resources, 'docs-sections.json', 'docs-symbols.json']);
  for (const source of ['config/diagnostics/catalog.json', 'skills/marionette/agents/openai.yaml',
    'skills/marionette/scripts/docs.mjs',
    'examples/records/src/main.js', 'examples/records/README.md']) {
    assert.ok(manifest.assets.some(asset => asset.source === source), `Missing supporting resource: ${source}`);
  }
  const files = (await readdir(new URL('../../docs/', import.meta.url), { recursive: true })).filter(file => file.endsWith('.md'));
  for (const file of files) {
    assert.ok(manifest.pages.some(page => page.source === `docs/${file}`), `Missing page: ${file}`);
  }
  const entries = [...manifest.pages, ...manifest.assets];
  assert.equal(entries.some(entry => /^(planning|benchmarks|test)\//.test(entry.source)), false, 'Consumer export excludes evaluation evidence and test fixtures');
  assert.equal(manifest.assets.some(entry => entry.source.startsWith('config/api-contracts/')), false,
    'Maintainer metadata remains build input rather than a second consumer reference');
  for (const page of entries) {
    const exported = await readFile(new URL(`../../.docs-export/${page.source}`, import.meta.url));
    if (page.source === 'docs-sections.json') {
      const expected = (await Promise.all(manifest.pages.filter(isConsumerPage)
        .map(async value => documentSections(value.source,
          await readFile(new URL(`../../${value.source}`, import.meta.url), 'utf8'))))).flat();
      assert.deepEqual(JSON.parse(exported), { schemaVersion: 1, sections: expected });
    } else if (page.source === 'docs-symbols.json') {
      const inventory = JSON.parse(await readFile(new URL('../../config/api-contracts/inventory.json', import.meta.url), 'utf8'));
      const semantics = JSON.parse(await readFile(new URL('../../config/api-contracts/semantics.json', import.meta.url), 'utf8'));
      const { sections } = JSON.parse(await readFile(new URL('../../.docs-export/docs-sections.json', import.meta.url), 'utf8'));
      const index = JSON.parse(exported);
      assert.deepEqual(index, symbolIndex(inventory, semantics, sections));
      validateSymbolIndex(index, new Set(sections.map(section => section.id)));
      assert.equal(index.symbols.length, inventory.entrypoints.reduce((count, entry) => count + entry.exports.length, 0));
      const consumerFiles = new Map(await Promise.all(manifest.pages.filter(isConsumerPage).map(async entry =>
        [entry.source, { content: await readFile(new URL(`../../.docs-export/${entry.source}`, import.meta.url)) }])));
      const lookup = query => findSymbols(index, sections, consumerFiles, query);
      const detached = lookup('Region.detachView');
      assert(detached.matches[0].sections.some(section => section.heading === 'Empty, detach, reset, and destroy'));
      assert(lookup('RegionInstance.detachView').matches.some(match => match.entrypoint === 'marionette'));
      assert(lookup('Model.set').matches.some(match => match.entrypoint === '@mnjs/data'));
      assert(lookup('bindEvents').matches.some(match => match.entrypoint === '@mnjs/utils' && match.name === 'bindEvents'));
      assert(lookup('channel').matches.some(match => match.entrypoint === '@mnjs/radio'));
      for (const entry of inventory.entrypoints) {
        const value = entry.exports.find(symbol => symbol.kind === 'value');
        assert(lookup(value.name).matches.some(match => match.entrypoint === entry.name), entry.name);
      }
      assert.equal(lookup('default').matches.length, 5, 'Default adapters retain their separate entrypoints');
      assert.deepEqual(lookup('BackboneApi').matches, [], 'Local import names are not public export names');
      assert(lookup('listenTo').matches.length > 1, 'Bare members report all matching exports');
      assert.deepEqual(lookup('MissingPublicSymbol').matches, []);
      assert.deepEqual(lookup('Model.save').matches, [], 'Native data does not invent persistence');
    } else {
      const original = await readFile(new URL(`../../${page.source}`, import.meta.url));
      assert.deepEqual(exported, original);
    }
    assert.equal(sha256(exported), page.sha256);
  }
  assert.equal(contentDigest(entries), manifest.contentSha256);
  assert.equal(contentDigest([...entries].reverse()), manifest.contentSha256);
  const changed = entries.map((page, index) => index ? page : { ...page, sha256: sha256('changed') });
  assert.notEqual(contentDigest(changed), manifest.contentSha256);
});

async function assertModuleClosure(entries, readSource) {
  const exported = new Set(entries.map(entry => entry.source));
  const moduleQueue = entries.filter(asset =>
    /^(?:examples\/records\/src\/.*\.js|skills\/marionette\/scripts\/.*\.mjs)$/.test(asset.source)).map(asset => asset.source);
  const checkedModules = new Set();
  while (moduleQueue.length) {
    const source = moduleQueue.shift();
    if (checkedModules.has(source)) { continue; }
    checkedModules.add(source);
    const contents = await readSource(source);
    for (const match of contents.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)(['"])(\.[^'"]+)\1/g)) {
      const target = decodeTarget(source, match[2]);
      const dependency = posix.normalize(posix.join(posix.dirname(source), target));
      assert.ok(exported.has(dependency), `${source} imports omitted export source: ${dependency}`);
      if (/\.m?js$/.test(dependency)) { moduleQueue.push(dependency); }
    }
  }
}

test('module closure rejects a missing skill dependency', async() => {
  const entries = [{ source: 'skills/marionette/scripts/docs.mjs' }];
  await assert.rejects(assertModuleClosure(entries, async() => 'import { search } from \'./search.mjs\';'),
    /docs\.mjs imports omitted export source: skills\/marionette\/scripts\/search\.mjs/);
});

test('exports relative dependencies of examples and raw Markdown resources', async() => {
  const manifest = await exportDocs();
  const entries = [...manifest.pages, ...manifest.assets];
  const exported = new Set(entries.map(entry => entry.source));
  const references = [];
  await assertModuleClosure(entries, source => readFile(new URL(`../../.docs-export/${source}`, import.meta.url), 'utf8'));
  for (const asset of entries) {
    const contents = await readFile(new URL(`../../.docs-export/${asset.source}`, import.meta.url), 'utf8');
    if (asset.source.endsWith('.md')) {
      for (const href of await markdownTargets(contents)) {
        const target = href.replace(/^<|>$/g, '');
        if (!/^(?:[a-z]+:|#|\/)/i.test(target)) {
          references.push({ source: asset.source, target });
        }
      }
    }
  }
  for (const reference of references) {
    const target = decodeTarget(reference.source, reference.target);
    if (!target) { continue; }
    const source = posix.normalize(posix.join(posix.dirname(reference.source), target));
    assert.ok(exported.has(source), `${reference.source} references omitted export source: ${source}`);
    await readFile(new URL(`../../.docs-export/${source}`, import.meta.url));
  }
});
