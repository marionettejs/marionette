import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../..');
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'test-consumer-report-'));
  const script = join(directory, 'test/examples/verify-test-package.mjs');
  mkdirSync(join(directory, 'test/examples'), { recursive: true });
  mkdirSync(join(directory, 'packages/test/examples'), { recursive: true });
  mkdirSync(join(directory, 'tmp'));
  cpSync(join(root, 'test/examples/verify-test-package.mjs'), script);
  writeFileSync(join(directory, 'packages/test/package.json'), JSON.stringify({ version: '0.1.0' }));
  writeFileSync(join(directory, 'packages/test/examples/package.json'), JSON.stringify({
    dependencies: { marionette: '5.0.0' }, devDependencies: { '@playwright/test': '1.63.0' }
  }));
  writeFileSync(join(directory, 'packages/test/examples/package-lock.json'), '{}');
  return { directory, script, output: join(directory, 'report') };
}

test('consumer verification reports missing npm context without leaking a workspace', () => {
  const { directory, script, output } = fixture();
  try {
    const env = { ...process.env, TMPDIR: join(directory, 'tmp') };
    delete env.npm_execpath;
    const result = spawnSync(process.execPath, [script, '--output', output], { env, encoding: 'utf8' });
    assert.equal(result.status, 1);
    const report = JSON.parse(readFileSync(join(output, 'report.json'), 'utf8'));
    assert.equal(report.passed, false);
    assert.match(report.error, /through npm/);
    assert.deepEqual(readdirSync(join(directory, 'tmp')), []);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('consumer verification records tracked deletions and still reports a later command failure', () => {
  const { directory, script, output } = fixture();
  try {
    const deleted = 'packages/test/deleted.js';
    writeFileSync(join(directory, deleted), 'export const removed = true;\n');
    execFileSync('git', ['init', '-q'], { cwd: directory });
    execFileSync('git', ['add', '.'], { cwd: directory });
    execFileSync('git', ['-c', 'user.name=Consumer verifier test', '-c', 'user.email=test@example.invalid',
      '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'fixture'], { cwd: directory });
    unlinkSync(join(directory, deleted));
    const npmCli = join(directory, 'npm.mjs');
    writeFileSync(npmCli, 'throw new Error("intentional pack stop");\n');
    const result = spawnSync(process.execPath, [script, '--output', output], {
      env: { ...process.env, TMPDIR: join(directory, 'tmp'), npm_execpath: npmCli }, encoding: 'utf8'
    });
    assert.equal(result.status, 1);
    const report = JSON.parse(readFileSync(join(output, 'report.json'), 'utf8'));
    assert.equal(report.passed, false);
    assert.equal(report.sourceDirty, true);
    assert.deepEqual(report.sourceFiles.find(file => file.path === deleted), { path: deleted, deleted: true });
    assert.deepEqual(report.stages, [{ name: 'pack', passed: false }]);
    assert.match(readFileSync(join(output, 'pack.log'), 'utf8'), /intentional pack stop/);
    assert.deepEqual(readdirSync(join(directory, 'tmp')), []);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
