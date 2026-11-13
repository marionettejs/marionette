import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';

test('release profile rejects consumer support and required verification drift', async t => {
  const repository = resolve(import.meta.dirname, '../..');
  const root = await mkdtemp(join(tmpdir(), 'marionette-release-profile-'));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 3 }));
  const manifests = ['package.json', ...['utils', 'radio', 'data', 'adapters']
    .map(name => `packages/${name}/package.json`)];
  for (const file of [...manifests, 'package-lock.json', 'config/release-profile.json',
    'scripts/checks/release-profile.mjs', 'scripts/release/packages.mjs', '.github/workflows']) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await cp(join(repository, file), join(root, file), { recursive: true });
  }
  // Isolate consumer-range validation from the machine's installed source tools.
  // The checker reads npm's manifest; this fixture never executes a fake npm CLI.
  const profile = JSON.parse(await readFile(join(root, 'config/release-profile.json'), 'utf8'));
  profile.source.node = process.versions.node;
  await writeFile(join(root, 'config/release-profile.json'), JSON.stringify(profile));
  await writeFile(join(root, '.nvmrc'), process.versions.node);
  await mkdir(join(root, 'npm/bin'), { recursive: true });
  await writeFile(join(root, 'npm/package.json'), JSON.stringify({ version: profile.source.npm }));
  const run = () => spawnSync(process.execPath, [join(root, 'scripts/checks/release-profile.mjs')], {
    encoding: 'utf8', env: { ...process.env, npm_execpath: join(root, 'npm/bin/npm-cli.js') },
  });
  const baseline = run();
  assert.equal(baseline.status, 0, baseline.stderr);
  for (const file of manifests) {
    const path = join(root, file);
    const original = await readFile(path, 'utf8');
    for (const range of ['>=20', '>=26']) {
      const manifest = JSON.parse(original);
      manifest.engines.node = range;
      await writeFile(path, JSON.stringify(manifest));
      const result = run();
      assert.equal(result.status, 1, `${file}: ${range}\n${result.stderr}`);
      assert(result.stderr.includes(`${file} engines.node`), result.stderr);
      await writeFile(path, original);
    }
  }
  for (const [file, before, after, message] of [
    ['ci.yml', 'name: Node 26 LTS packages', 'continue-on-error: true\n    name: Node 26 LTS packages', /must test Node 26 as a required job/],
    ['ci.yml', ', node-lts]', ']', /aggregate must require node-lts/],
    ['docs-pages.yml', '\'22.22.2\', ', '', /must require the consumer Node matrix/],
    ['docs-pages.yml', ', \'26.0.0\'', '', /must require the consumer Node matrix/],
    ['release.yml', ', \'26\'', '', /must require the consumer Node matrix/],
    ['release.yml', ', consumer-lts]', ']', /promotion must require consumer-lts/],
  ]) {
    const path = join(root, '.github/workflows', file);
    const original = await readFile(path, 'utf8');
    assert(original.includes(before), before);
    await writeFile(path, original.replace(before, after));
    const result = run();
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, message);
    await writeFile(path, original);
  }

  // A following job must not supply a missing promotion dependency, including
  // valid job IDs with underscores or uppercase letters.
  const releasePath = join(root, '.github/workflows/release.yml');
  const original = await readFile(releasePath, 'utf8');
  const missingGate = original.replace(', consumer-lts]', ']');
  const following = missingGate.slice(missingGate.indexOf('  certified_artifact:\n'),
    missingGate.indexOf('  publication-targets:\n'));
  assert(following.includes('    needs: preflight'));
  for (const id of ['certified_artifact', 'Certified_Artifact']) {
    const workflow = missingGate.replace(following,
      following.replace('    needs: preflight', '    needs: [preflight, consumer-lts]'))
      .replaceAll('certified_artifact', id);
    await writeFile(releasePath, workflow);
    const result = run();
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /promotion must require consumer-lts/);
  }
  await writeFile(releasePath, original);

});
