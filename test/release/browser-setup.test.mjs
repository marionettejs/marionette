import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { fixture } from './fixture.mjs';
import { copyCoverageFixture } from '../tooling/coverage-fixture.mjs';

async function browserSetup(t) {
  const candidate = await fixture(t);
  const script = resolve(candidate.root, 'test/browser/global-setup.mjs');
  await copyCoverageFixture(resolve(import.meta.dirname, '../browser/global-setup.mjs'), script);
  function run() {
    return spawnSync(process.execPath, ['--input-type=module', '--eval', `
      import setup from ${JSON.stringify(pathToFileURL(script).href)};
      const cleanup = await setup();
      await cleanup();
    `], {
      cwd: candidate.root, encoding: 'utf8', timeout: 30000,
      env: { ...process.env, MARIONETTE_BROWSER_ARTIFACT_MANIFEST: resolve(candidate.artifacts, 'release-evidence.json') },
    });
  }
  return { ...candidate, setup: run };
}

test('browser setup records exact supplied package identities and hashes', async t => {
  const candidate = await browserSetup(t);
  const result = candidate.setup();
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(await readFile(resolve(candidate.root, 'test/tmp/browser/candidate.json')));
  assert.deepEqual(report, {
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
