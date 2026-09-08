import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { contentDigest, exportDocs, readResources, sha256, validateNavigation } from '../../scripts/docs/export.mjs';

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
    await writeFile(resolve(repository, 'unlisted.md'), 'Do not export adjacent files.');
    await writeFile(resolve(outside, 'private.md'), 'Outside the repository.');
    const resources = await readResources(repository, ['guide.md']);
    assert.deepEqual(resources.map(entry => entry.source), ['guide.md']);
    assert.equal(resources[0].bytes.toString(), 'Read this exact text.\n');
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

test('exports every current top-level guide with exact bytes and reproducible provenance', async() => {
  const manifest = await exportDocs();
  const again = await exportDocs();
  assert.deepEqual(again, manifest);
  assert.match(manifest.sourceRevision, /^[a-f0-9]{40}$/);
  assert.equal(typeof manifest.sourceDirty, 'boolean');
  const resources = JSON.parse(await readFile(new URL('../../docs-site/resources.json', import.meta.url), 'utf8'));
  assert.deepEqual(manifest.assets.map(asset => asset.source), resources);
  for (const source of ['config/diagnostics/catalog.json', 'skills/marionette/scripts/docs.mjs',
    'test/fixtures/docs-routing/validate.mjs', 'benchmarks/docs/results/2026-09-08/latest-navigation/solution.mjs']) {
    assert.ok(manifest.assets.some(asset => asset.source === source), `Missing supporting resource: ${source}`);
  }
  const files = (await readdir(new URL('../../docs/', import.meta.url))).filter(file => file.endsWith('.md'));
  for (const file of files) {
    assert.ok(manifest.pages.some(page => page.source === `docs/${file}`), `Missing page: ${file}`);
  }
  const entries = [...manifest.pages, ...manifest.assets];
  for (const page of entries) {
    const original = await readFile(new URL(`../../${page.source}`, import.meta.url));
    const exported = await readFile(new URL(`../../.docs-export/${page.source}`, import.meta.url));
    assert.deepEqual(exported, original);
    assert.equal(sha256(exported), page.sha256);
  }
  assert.equal(contentDigest(entries), manifest.contentSha256);
  assert.equal(contentDigest([...entries].reverse()), manifest.contentSha256);
  const changed = entries.map((page, index) => index ? page : { ...page, sha256: sha256('changed') });
  assert.notEqual(contentDigest(changed), manifest.contentSha256);
});
