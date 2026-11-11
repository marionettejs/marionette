import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { fixture } from './fixture.mjs';
import { copyCoverageFixture } from '../tooling/coverage-fixture.mjs';

async function browserSetup(t) {
  const candidate = await fixture(t);
  const script = resolve(candidate.root, 'test/browser/global-setup.mjs');
  await copyCoverageFixture(resolve(import.meta.dirname, '../browser/global-setup.mjs'), script);
  await mkdir(resolve(candidate.root, 'test/docs'), { recursive: true });
  await mkdir(resolve(candidate.root, 'packages/html'), { recursive: true });
  await copyCoverageFixture(resolve(import.meta.dirname, '../docs/html-candidate.mjs'), resolve(candidate.root, 'test/docs/html-candidate.mjs'));
  const manifest = { name: '@mnjs/html', version: '0.1.0', exports: { '.': './index.js', './marionette': './marionette.js' } };
  const input = resolve(candidate.root, 'renderer/package');
  await mkdir(input, { recursive: true });
  await writeFile(resolve(input, 'package.json'), JSON.stringify(manifest));
  await writeFile(resolve(candidate.root, 'packages/html/package.json'), JSON.stringify(manifest));
  const renderer = resolve(candidate.artifacts, 'html.tgz');
  const packed = spawnSync('tar', ['-czf', renderer, '-C', resolve(input, '..'), 'package'], { encoding: 'utf8' });
  assert.equal(packed.status, 0, packed.stderr);

  function run() {
    return spawnSync(process.execPath, ['--input-type=module', '--eval', `
      import setup from ${JSON.stringify(pathToFileURL(script).href)};
      const cleanup = await setup();
      await cleanup();
    `], {
      cwd: candidate.root, encoding: 'utf8', timeout: 30000,
      env: { ...process.env, MNJS_HTML_TARBALL: renderer, MARIONETTE_BROWSER_ARTIFACT_MANIFEST: resolve(candidate.artifacts, 'release-evidence.json') },
    });
  }
  return { ...candidate, setup: run };
}

test('browser setup records exact supplied package identities and hashes', async t => {
  const candidate = await browserSetup(t);
  const result = candidate.setup();
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(await readFile(resolve(candidate.root, 'test/tmp/browser/candidate.json')));
  assert.equal(report.renderer.name, '@mnjs/html');
  assert.equal(report.renderer.version, '0.1.0');
  assert.match(report.renderer.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual({ source: report.source, packages: report.packages }, {
    source: candidate.evidence.source,
    packages: candidate.evidence.packages.map(({ manifest, ...entry }) => entry),
  });
});

test('browser setup rejects special and escaping filenames before reading a tarball', async t => {
  const candidate = await browserSetup(t);
  for (const file of ['.', '..', 'C:utils.tgz', 'utils.tgz:stream', '../utils.tgz', '\\utils.tgz']) {
    candidate.evidence.packages[0].tarball.file = file;
    await writeFile(resolve(candidate.artifacts, 'release-evidence.json'), JSON.stringify(candidate.evidence));
    const result = candidate.setup();
    assert.equal(result.status, 1, file);
    assert.match(result.stderr, /Browser artifact must be a tarball filename/);
  }
});
