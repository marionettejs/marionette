import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';

test('release profile rejects broader and narrower engines in every published package', async t => {
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
});
