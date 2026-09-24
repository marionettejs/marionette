import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { marked } from 'marked';
import { stagePackage } from '../../scripts/docs/stage-package.mjs';

test('packed guides keep source bytes and resolve at repository-relative paths', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'marionette-package-links-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, 'scripts'));
  await writeFile(resolve(root, 'scripts/not-exported.mjs'), 'throw new Error("source-only");');
  await mkdir(resolve(root, 'dist'), { recursive: true });
  await mkdir(resolve(root, '.docs-export/docs'), { recursive: true });
  const manifest = {
    sourceRepository: 'https://github.com/marionettejs/marionette', sourceRevision: 'a'.repeat(40),
    pages: [{ source: 'docs/view.md' }, { source: 'docs/guide(v2).md' }], assets: []
  };
  const pkg = JSON.stringify({ name: 'marionette-link-fixture', version: '1.0.0',
    files: ['dist/', 'scripts/', 'docs/', 'docs-manifest.json', 'readme.md', 'upgradeGuide.md', 'license.txt'], main: 'dist/index.js' });
  const source = '[View\nreference](docs/view.md#render "View")\n' +
    '[Guide][view]\n\n[view]: <docs/view.md#render> "View"\n' +
    '[Parentheses](docs/guide(v2).md) [License](license.txt) [Upgrade](upgradeGuide.md)\n' +
    '[Web](https://example.com/)\n`[View](docs/view.md)`\n\n```md\n[View](docs/view.md)\n```\n' +
    '1. Example\n\n   ```md\n   [View](docs/view.md)\n   ```\n\n> ```md\n> [View](docs/view.md)\n> ```\n';
  for (const [file, content] of Object.entries({
    'package.json': pkg, 'readme.md': source, 'upgradeGuide.md': '[View](docs/view.md#render)',
    'license.txt': 'License', 'dist/index.js': 'export const value = 1;\n',
    '.docs-export/docs/view.md': '# View\n\n## Render\n', '.docs-export/docs/guide(v2).md': '# Guide\n'
  })) { await writeFile(resolve(root, file), content); }
  await stagePackage(root, manifest);
  await writeFile(resolve(root, '.package/stale.txt'), 'stale');
  await stagePackage(root, manifest);
  const [packed] = JSON.parse(execFileSync('npm', ['pack', './.package', '--ignore-scripts',
    '--offline', '--json', '--pack-destination', root], { cwd: root, encoding: 'utf8' }));
  const tarball = resolve(root, packed.filename);
  const files = new Set(execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' }).trim().split('\n'));
  const unpack = file => execFileSync('tar', ['-xOf', tarball, `package/${file}`], { encoding: 'utf8' });
  assert.equal(unpack('package.json'), pkg);
  assert.equal(unpack('readme.md'), source);
  assert.equal(unpack('upgradeGuide.md'), '[View](docs/view.md#render)');
  assert.equal(unpack('dist/index.js'), 'export const value = 1;\n');
  assert.equal(unpack('docs/view.md'), '# View\n\n## Render\n');
  assert.deepEqual(JSON.parse(unpack('docs-manifest.json')), manifest);
  assert.equal(files.has('package/stale.txt'), false);
  assert.equal(files.has('package/scripts/not-exported.mjs'), false);
  assert.equal([...files].some(file => file.startsWith('package/dist/docs/')), false);
  for (const file of ['readme.md', 'upgradeGuide.md']) {
    await Promise.all(marked.walkTokens(marked.lexer(unpack(file)), token => {
      if (token.type !== 'link' || /^(?:https?:|#)/.test(token.href)) { return; }
      const [path, fragment] = token.href.split('#');
      assert.ok(files.has(`package/${path}`), `${file}: ${token.href}`);
      if (fragment) { assert.equal(fragment, 'render'); assert.match(unpack(path), /^## Render$/m); }
    }));
  }
  assert.equal(await readFile(resolve(root, 'readme.md'), 'utf8'), source);
  await writeFile(resolve(root, 'readme.md'), '[Escape](../outside.md)');
  await assert.rejects(stagePackage(root, manifest), /PACKAGED_DOC_LINK/);
  await writeFile(resolve(root, 'readme.md'), source);
  await rm(resolve(root, '.docs-export/docs/view.md'));
  await symlink(resolve(root, 'readme.md'), resolve(root, '.docs-export/docs/view.md'));
  await assert.rejects(stagePackage(root, manifest), /target escapes root/);
});
