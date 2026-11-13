import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fixture, git } from './fixture.mjs';

async function outputs(t) {
  const candidate = await fixture(t);
  await mkdir(resolve(candidate.root, 'test/docs'), { recursive: true });
  await cp(resolve(import.meta.dirname, '../docs/html-candidate.mjs'), resolve(candidate.root, 'test/docs/html-candidate.mjs'));
  const paths = ['dist', '.package', 'packages/html/artifacts', ...['utils', 'radio', 'data', 'adapters', 'test', 'router'].map(name => `packages/${name}/dist`)];
  for (const path of paths) {
    await mkdir(resolve(candidate.root, path), { recursive: true });
    await writeFile(resolve(candidate.root, path, 'built.txt'), `compiled ${path}`);
  }
  await mkdir(resolve(candidate.root, 'src'));
  await writeFile(resolve(candidate.root, 'src/version.js'), 'compiled version');
  await writeFile(candidate.npmCli, `console.log('${candidate.evidence.toolchain.npm}');`);
  await writeFile(resolve(candidate.root, 'package-lock.json'), '{}');
  const directory = resolve(candidate.directory, 'build-outputs');
  const output = resolve(candidate.directory, 'github-output');
  const capture = candidate.run('build-outputs', ['--mode', 'capture', '--directory', directory], { GITHUB_OUTPUT: output });
  assert.equal(capture.status, 0, capture.stderr);
  const sha256 = capture.stdout.trim();
  assert.equal(await readFile(output, 'utf8'), `sha256=${sha256}\n`);
  return { ...candidate, paths, directory, sha256,
    restore: (args = [], env = {}) => candidate.run('build-outputs', ['--mode', 'restore', '--directory', directory, '--sha256', sha256, ...args], { GITHUB_ENV: '', GITHUB_OUTPUT: '', ...env }) };
}

test('build transfer restores every output, including generated version, under the producer SHA and toolchain', async t => {
  const candidate = await outputs(t);
  for (const path of [...candidate.paths, 'src/version.js']) { await rm(resolve(candidate.root, path), { recursive: true }); }
  const restored = candidate.restore();
  assert.equal(restored.status, 0, restored.stderr);
  for (const path of candidate.paths) { assert.equal(await readFile(resolve(candidate.root, path, 'built.txt'), 'utf8'), `compiled ${path}`); }
  assert.equal(await readFile(resolve(candidate.root, 'src/version.js'), 'utf8'), 'compiled version');
});

for (const mutation of ['bytes', 'sha', 'lock', 'npm', 'node']) {
  test(`build transfer rejects mismatched ${mutation} before replacing outputs`, async t => {
    const candidate = await outputs(t);
    if (mutation === 'bytes') { await writeFile(resolve(candidate.directory, 'build-outputs.tar'), 'corrupt'); }
    if (mutation === 'sha') { git(candidate.root, ['-c', 'user.name=Tests', '-c', 'user.email=tests@example.invalid', 'commit', '--allow-empty', '-qm', 'another SHA']); }
    if (mutation === 'lock') { await writeFile(resolve(candidate.root, 'package-lock.json'), 'changed lock'); }
    if (mutation === 'npm') { await writeFile(candidate.npmCli, 'console.log(\'0.0.0\');'); }
    if (mutation === 'node') {
      const path = resolve(candidate.root, 'config/release-profile.json');
      const profile = JSON.parse(await readFile(path)); profile.source.node = '0.0.0'; await writeFile(path, JSON.stringify(profile));
    }
    const result = candidate.restore();
    assert.equal(result.status, 1);
    assert.equal(await readFile(resolve(candidate.root, 'dist/built.txt'), 'utf8'), 'compiled dist');
  });
}

test('build restore requires the independent producer checksum and rejects unknown operations', async t => {
  const candidate = await outputs(t);
  for (const args of [['--mode', 'invalid'], ['--mode', 'restore'], ['--mode', 'restore', '--sha256', 'not-a-hash']]) {
    assert.equal(candidate.run('build-outputs', ['--directory', candidate.directory, ...args]).status, 1);
  }
});

test('restored renderer is explicitly selected for downstream browser and fixture reuse', async t => {
  const candidate = await outputs(t);
  const renderer = resolve(candidate.directory, 'renderer/package');
  await mkdir(renderer, { recursive: true });
  const manifest = { name: '@mnjs/html', version: '0.1.0', exports: { '.': './index.js', './marionette': './marionette.js' } };
  await writeFile(resolve(renderer, 'package.json'), JSON.stringify(manifest));
  await writeFile(resolve(candidate.root, 'packages/html/package.json'), JSON.stringify(manifest));
  const artifact = resolve(candidate.root, 'packages/html/artifacts/mnjs-html-0.1.0.tgz');
  assert.equal(spawnSync('tar', ['-czf', artifact, '-C', dirname(renderer), 'package']).status, 0);
  const capture = candidate.run('build-outputs', ['--mode', 'capture', '--directory', candidate.directory]);
  assert.equal(capture.status, 0, capture.stderr);
  const environment = resolve(candidate.directory, 'github-env');
  const restored = candidate.run('build-outputs', ['--mode', 'restore', '--directory', candidate.directory, '--sha256', capture.stdout.trim()], { GITHUB_ENV: environment, MNJS_HTML_TARBALL: '/unrelated-renderer.tgz' });
  assert.equal(restored.status, 0, restored.stderr);
  assert.equal(await readFile(environment, 'utf8'), `MNJS_HTML_TARBALL=${artifact}\n`);
});
