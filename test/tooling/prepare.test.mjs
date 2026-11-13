import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { copyCoverageFixture } from './coverage-fixture.mjs';

const source = resolve(import.meta.dirname, '../../build/prepare.mjs');
async function setup(t) {
  const root = await mkdtemp(join(tmpdir(), 'mnjs-prepare-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'build'));
  await copyCoverageFixture(source, join(root, 'build/prepare.mjs'));
  return root;
}

for (const skip of ['', '1', 'true']) {
  test(`root preparation skips only the explicit CI opt-out (${skip || 'unset'})`, async t => {
    const root = await setup(t);
    const cli = join(root, 'npm.cjs');
    const calls = join(root, 'calls.jsonl');
    await writeFile(cli, `require('node:fs').appendFileSync(${JSON.stringify(calls)}, JSON.stringify(process.argv.slice(2)) + '\\n');`);
    const result = spawnSync(process.execPath, [join(root, 'build/prepare.mjs')], {
      env: { ...process.env, npm_execpath: cli, MNJS_SKIP_PREPARE: skip }, encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    if (skip === '1') { await assert.rejects(readFile(calls), { code: 'ENOENT' }); } else { assert.deepEqual((await readFile(calls, 'utf8')).trim().split('\n').map(JSON.parse), [['run', 'build'], ['run', 'test:dist']]); }
  });
}

test('failed build stops preparation and retains the failure status', async t => {
  const root = await setup(t);
  const cli = join(root, 'npm.cjs');
  await writeFile(cli, 'process.exit(3);');
  const result = spawnSync(process.execPath, [join(root, 'build/prepare.mjs')], { env: { ...process.env, npm_execpath: cli, MNJS_SKIP_PREPARE: '' } });
  assert.equal(result.status, 3);
});

test('npm ci still executes dependency install scripts while root preparation is skipped', async t => {
  const root = await setup(t);
  const dependency = join(root, 'dependency');
  await mkdir(dependency);
  await writeFile(join(dependency, 'package.json'), JSON.stringify({ name: 'install-script-dependency', version: '1.0.0',
    scripts: { install: 'node -e "require(\'node:fs\').writeFileSync(process.env.PREPARE_MARKER, \'installed\')"' } }));
  const npm = args => spawnSync(process.execPath, [process.env.npm_execpath, ...args], {
    cwd: root, encoding: 'utf8', timeout: 120000,
    env: { ...process.env, MNJS_SKIP_PREPARE: '1', PREPARE_MARKER: join(root, 'dependency-ran') },
  });
  const packed = npm(['pack', dependency, '--ignore-scripts', '--json', '--pack-destination', root]);
  assert.equal(packed.status, 0, packed.stderr);
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'prepare-install-test', private: true,
    scripts: { prepare: 'node build/prepare.mjs', build: 'node -e "process.exit(99)"' },
    dependencies: { 'install-script-dependency': `file:${join(root, 'install-script-dependency-1.0.0.tgz')}` },
    allowScripts: { [`file:${join(root, 'install-script-dependency-1.0.0.tgz')}`]: true } }));
  await writeFile(join(root, '.npmrc'), 'strict-allow-scripts=true\n');
  const lock = npm(['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund']);
  assert.equal(lock.status, 0, lock.stderr);
  const installed = npm(['ci', '--no-audit', '--no-fund']);
  assert.equal(installed.status, 0, installed.stderr);
  assert.equal(await readFile(join(root, 'dependency-ran'), 'utf8'), 'installed');
});
