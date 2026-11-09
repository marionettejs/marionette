import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

test('lock validator rejects incomplete optional platform metadata', () => {
  const root = mkdtempSync(join(tmpdir(), 'html-lock-'));
  try {
    mkdirSync(join(root, 'scripts'));
    copyFileSync(new URL('../scripts/check-lockfile.mjs', import.meta.url), join(root, 'scripts/check-lockfile.mjs'));
    copyFileSync(new URL('../package.json', import.meta.url), join(root, 'package.json'));
    const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url)));
    const run = () => {
      writeFileSync(join(root, 'package-lock.json'), JSON.stringify(lock));
      return spawnSync(process.execPath, [join(root, 'scripts/check-lockfile.mjs')], {encoding: 'utf8'});
    };
    assert.equal(run().status, 0);
    lock.packages['node_modules/rollup/node_modules/@rollup/rollup-linux-x64-gnu'] = {dev: true, optional: true};
    const failed = run();
    assert.notEqual(failed.status, 0);
    assert.match(failed.stderr, /missing version, including optional platform dependencies/);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});
