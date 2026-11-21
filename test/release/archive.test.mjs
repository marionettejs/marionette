import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { test } from 'node:test';
import { extractTar, readTarFile } from '../../scripts/release/archive.mjs';

async function archive(t, gzip = false) {
  const directory = await mkdtemp(join(tmpdir(), 'mnjs archive portability '));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'package'));
  const manifest = { name: 'archive-portability', version: '1.0.0' };
  await writeFile(join(directory, 'package/package.json'), JSON.stringify(manifest));
  await writeFile(join(directory, 'package/payload.txt'), 'exact candidate bytes\n');
  // No archive path is passed to tar, even when creating this test fixture.
  const packed = spawnSync('tar', [gzip ? '-czf' : '-cf', '-', 'package'], { cwd: directory });
  assert.equal(packed.status, 0, packed.stderr?.toString());
  // Unix permits the colon spelling that triggers GNU tar's remote syntax.
  // Windows exercises its actual absolute drive-letter path instead.
  const path = join(directory, process.platform === 'win32' ? 'candidate.tar' : 'D:candidate.tar');
  await writeFile(path, packed.stdout);
  return { directory, path, manifest };
}

test('the targeted archive tool is available and honors the GNU runner requirement', () => {
  const version = spawnSync('tar', ['--version'], { encoding: 'utf8' });
  assert.equal(version.status, 0, version.stderr);
  if (process.env.MNJS_REQUIRE_GNU_TAR === '1') { assert.match(version.stdout, /GNU tar/); }
});

test('stdin avoids GNU tar remote-host parsing of an existing drive/colon archive', async t => {
  const version = spawnSync('tar', ['--version'], { encoding: 'utf8' });
  if (!/GNU tar/.test(version.stdout)) {
    t.skip('Remote-host path parsing is specific to GNU tar');
    return;
  }
  const candidate = await archive(t);
  // On Unix the relative spelling places the colon before any slash, as an
  // absolute Windows drive-letter path does on the hosted Git Bash runner.
  const path = process.platform === 'win32' ? candidate.path : basename(candidate.path);
  // If a drive name resolves, Node rejects that hostname as a missing script
  // instead of attempting a real remote shell. Bound hostname lookup as well.
  const legacy = spawnSync('tar', [`--rsh-command=${process.execPath}`, '-xOf', path, 'package/package.json'], {
    cwd: candidate.directory, encoding: 'utf8', timeout: 5000,
  });
  assert.ifError(legacy.error);
  assert.notEqual(legacy.status, 0, 'GNU tar must reject the remote-host spelling');
  assert.deepEqual(JSON.parse(readTarFile(await readFile(candidate.path), 'package/package.json')), candidate.manifest);
});

for (const gzip of [false, true]) {
  test(`manifest reading handles ${gzip ? 'gzip' : 'raw'} bytes despite drive/colon paths and spaces`, async t => {
    const candidate = await archive(t, gzip);
    const bytes = await readFile(candidate.path);
    assert.deepEqual(JSON.parse(readTarFile(bytes, 'package/package.json', { gzip })), candidate.manifest);
  });
}

test('snapshot extraction handles raw bytes into a directory with spaces', async t => {
  const candidate = await archive(t);
  const destination = join(candidate.directory, 'restored outputs');
  await mkdir(destination);
  extractTar(await readFile(candidate.path), destination);
  assert.equal(await readFile(join(destination, 'package/payload.txt'), 'utf8'), 'exact candidate bytes\n');
  assert.deepEqual(JSON.parse(await readFile(join(destination, 'package/package.json'))), candidate.manifest);
});

test('archive errors propagate instead of accepting a missing member or corrupt bytes', async t => {
  const candidate = await archive(t);
  const bytes = await readFile(candidate.path);
  assert.throws(() => readTarFile(bytes, 'package/missing.json'), /tar exited with status/);
  const destination = join(candidate.directory, 'corrupt output');
  await mkdir(destination);
  assert.throws(() => readTarFile(Buffer.from('corrupt'), 'package/package.json'), /tar exited with status/);
  assert.throws(() => extractTar(Buffer.from('corrupt'), destination), /tar exited with status/);
});
