import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { marked } from 'marked';
import { stagePackage } from '../../scripts/docs/stage-package.mjs';

test('packed entrypoints resolve locally without changing source docs or package metadata', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'marionette-package-links-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, 'dist/docs/docs'), { recursive: true });
  const manifest = {
    sourceRepository: 'https://github.com/marionettejs/marionette',
    sourceRevision: 'a'.repeat(40),
    pages: [{ source: 'docs/view.md' }], assets: []
  };
  const pkg = JSON.stringify({ name: 'marionette-link-fixture', version: '1.0.0',
    files: ['dist/', 'readme.md', 'upgradeGuide.md', 'license.txt'], main: 'dist/index.js' });
  const source = '[View\nreference](docs/view.md#render "View")\n' +
    '[Guide][view]\n\n[view]: <docs/view.md#render> "View"\n' +
    '[Contributing](CONTRIBUTING.md) [License](license.txt) [Upgrade](upgradeGuide.md)\n' +
    '[Web](https://example.com/) [Section](#local)\n' +
    '`[View](docs/view.md)`\n\n```md\n[View](docs/view.md)\n```\n';
  for (const [file, content] of Object.entries({
    'package.json': pkg, 'readme.md': source, 'upgradeGuide.md': '[View](docs/view.md)',
    'license.txt': 'License', 'CONTRIBUTING.md': 'Contributing',
    'dist/index.js': 'export const value = 1;\n', 'dist/docs/docs/view.md': '# View\n\n## Render\n'
  })) { await writeFile(resolve(root, file), content); }
  await stagePackage(root, manifest);
  // A second staging pass must discard leftovers from the previous output.
  await writeFile(resolve(root, '.package/stale.txt'), 'stale');
  await stagePackage(root, manifest);
  const [packed] = JSON.parse(execFileSync('npm', ['pack', './.package', '--ignore-scripts',
    '--offline', '--json', '--pack-destination', root], { cwd: root, encoding: 'utf8' }));
  const tarball = resolve(root, packed.filename);
  const files = new Set(execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' }).trim().split('\n'));
  const unpack = file => execFileSync('tar', ['-xOf', tarball, `package/${file}`], { encoding: 'utf8' });
  assert.equal(unpack('package.json'), pkg);
  assert.equal(unpack('dist/index.js'), 'export const value = 1;\n');
  assert.equal(unpack('dist/docs/docs/view.md'), '# View\n\n## Render\n');
  assert.equal(files.has('package/stale.txt'), false);
  const readme = unpack('readme.md');
  assert.ok(readme.includes('[View\nreference](dist/docs/docs/view.md#render "View")'));
  assert.ok(readme.includes('[view]: <dist/docs/docs/view.md#render> "View"'));
  assert.ok(readme.includes(`${manifest.sourceRepository}/blob/${manifest.sourceRevision}/CONTRIBUTING.md`));
  assert.ok(readme.includes('`[View](docs/view.md)`'));
  assert.ok(readme.includes('```md\n[View](docs/view.md)\n```'));
  for (const file of ['readme.md', 'upgradeGuide.md']) {
    await Promise.all(marked.walkTokens(marked.lexer(unpack(file)), token => {
      if (token.type !== 'link' || /^(?:https?:|#)/.test(token.href)) { return; }
      assert.ok(files.has(`package/${token.href.split('#')[0]}`), `${file}: ${token.href}`);
    }));
  }
  assert.equal(await readFile(resolve(root, 'readme.md'), 'utf8'), source);
  assert.equal(await readFile(resolve(root, 'upgradeGuide.md'), 'utf8'), '[View](docs/view.md)');
  assert.equal(await readFile(resolve(root, 'package.json'), 'utf8'), pkg);
  await rm(resolve(root, 'dist/docs/docs/view.md'));
  await assert.rejects(stagePackage(root, manifest), /PACKAGED_DOC_LINK/);
});
