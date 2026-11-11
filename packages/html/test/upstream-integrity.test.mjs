import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, mkdtempSync, mkdirSync, cpSync, copyFileSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

test('upstream integrity rejects changed, missing and extra fixtures and helper drift', () => {
  const root = mkdtempSync(join(tmpdir(), 'html-upstream-'));
  try {
    mkdirSync(join(root, 'scripts'));
    mkdirSync(join(root, 'test'));
    cpSync(new URL('../vendor/', import.meta.url), join(root, 'vendor'), {recursive: true});
    copyFileSync(new URL('../scripts/check-upstream.mjs', import.meta.url), join(root, 'scripts/check-upstream.mjs'));
    copyFileSync(new URL('./upstream-markers.mjs', import.meta.url), join(root, 'test/upstream-markers.mjs'));
    const run = () => spawnSync(process.execPath, [join(root, 'scripts/check-upstream.mjs')], {encoding: 'utf8'});
    assert.equal(run().status, 0);
    const fixture = join(root, 'vendor/lit-html-3.3.3/test/guard_test.ts');
    const original = readFileSync(fixture);
    writeFileSync(fixture, Buffer.concat([original, Buffer.from('\n')]));
    assert.match(run().stderr, /Upstream Git blob mismatch/);
    rmSync(fixture);
    assert.notEqual(run().status, 0);
    writeFileSync(fixture, original);
    const extra = join(root, 'vendor/lit-html-3.3.3/test/extra.ts');
    writeFileSync(extra, '');
    assert.match(run().stderr, /Unexpected or missing vendored files/);
    rmSync(extra);
    const helper = join(root, 'test/upstream-markers.mjs');
    writeFileSync(helper, readFileSync(helper, 'utf8') + '\n');
    assert.match(run().stderr, /Derived marker helper drifted/);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('upstream recovery rejects an unverified archive before creating a destination', () => {
  const root = mkdtempSync(join(tmpdir(), 'html-upstream-recovery-'));
  try {
    const archive = join(root, 'invalid.tgz');
    writeFileSync(archive, 'not the pinned archive');
    const result = spawnSync(process.execPath, [
      fileURLToPath(new URL('../scripts/recover-upstream.mjs', import.meta.url)),
      archive, join(root, 'recovered'),
    ], {encoding: 'utf8'});
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Archive integrity mismatch/);
    assert.equal(existsSync(join(root, 'recovered')), false);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});
