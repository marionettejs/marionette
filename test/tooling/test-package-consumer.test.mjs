import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
  writeFileSync(join(directory, 'packages/test/examples/package-lock.json'), JSON.stringify({ packages: {
    '': { dependencies: { '@mnjs/test': 'file:..' } },
    'node_modules/@mnjs/test': { version: '0.1.0', resolved: 'file:..' }
  } }));
  return { directory, script, output: join(directory, 'report'), temporary: join(directory, 'tmp') };
}

test('consumer verification reports missing npm context without leaking a workspace', () => {
  const { directory, script, output, temporary } = fixture();
  try {
    const env = { ...process.env, TMPDIR: temporary, TEMP: temporary, TMP: temporary };
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
  const { directory, script, output, temporary } = fixture();
  try {
    const deleted = 'packages/test/deleted.js';
    writeFileSync(join(directory, deleted), 'export const removed = true;\n');
    execFileSync('git', ['init', '-q'], { cwd: directory });
    execFileSync('git', ['add', '.'], { cwd: directory });
    execFileSync('git', ['-c', 'user.name=Consumer verifier test', '-c', 'user.email=test@example.invalid',
      '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'fixture'], { cwd: directory });
    unlinkSync(join(directory, deleted));
    const npmCli = join(directory, 'npm.mjs');
    writeFileSync(npmCli, [
      'import assert from \'node:assert/strict\';',
      'import { realpathSync, readdirSync } from \'node:fs\';',
      'import { tmpdir } from \'node:os\';',
      'assert.equal(realpathSync(tmpdir()), realpathSync(process.env.MNJS_TEST_TEMP));',
      'const entries = readdirSync(process.env.MNJS_TEST_TEMP);',
      'assert.equal(entries.length, 1);',
      'assert(entries[0].startsWith(\'mnjs-test-consumer-\'));',
      'throw new Error("intentional pack stop");'
    ].join('\n'));
    const result = spawnSync(process.execPath, [script, '--output', output], {
      env: { ...process.env, TMPDIR: temporary, TEMP: temporary, TMP: temporary,
        MNJS_TEST_TEMP: temporary, npm_execpath: npmCli }, encoding: 'utf8'
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

for (const { mismatch, minimum } of [
  { mismatch: false, minimum: false }, { mismatch: true, minimum: false }, { mismatch: false, minimum: true }
]) {
  test(`supplied archive ${mismatch ? 'rejects a different digest' : `reaches ${minimum ? 'minimum-peer' : 'locked'} installation without repacking`}`, () => {
    const { directory, script, output, temporary } = fixture();
    try {
      execFileSync('git', ['init', '-q'], { cwd: directory });
      execFileSync('git', ['add', '.'], { cwd: directory });
      execFileSync('git', ['-c', 'user.name=Consumer verifier test', '-c', 'user.email=test@example.invalid',
        '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'fixture'], { cwd: directory });
      mkdirSync(join(directory, 'package'));
      writeFileSync(join(directory, 'package/package.json'), JSON.stringify({ name: '@mnjs/test', version: '0.1.0' }));
      const artifact = join(directory, 'original.tgz');
      execFileSync('tar', ['-czf', artifact, '-C', directory, 'package/package.json']);
      const sha256 = createHash('sha256').update(readFileSync(artifact)).digest('hex');
      const npmCli = join(directory, 'npm.mjs');
      writeFileSync(npmCli, [
        'import assert from \'node:assert/strict\';',
        'import { existsSync, readFileSync } from \'node:fs\';',
        'import { createHash } from \'node:crypto\';',
        'const manifest = JSON.parse(readFileSync(\'package.json\'));',
        'assert.equal(manifest.dependencies[\'@mnjs/test\'], \'file:../artifact.tgz\');',
        ...(minimum ? [
          'assert.deepEqual(process.argv.slice(2), [\'install\', \'--ignore-scripts\', \'--strict-peer-deps\']);',
          'assert.equal(existsSync(\'package-lock.json\'), false);',
          'assert.equal(manifest.overrides, undefined);',
          'for (const [name, version] of Object.entries({ vitest: \'4.1.0\', \'@vitest/browser-playwright\': \'4.1.0\', \'@testing-library/dom\': \'8.7.0\', \'@cypress/mount-utils\': \'4.0.0\' })) { assert.equal(manifest.devDependencies[name], version); }'
        ] : [
          'assert.equal(process.argv[2], \'ci\');',
          'const lock = JSON.parse(readFileSync(\'package-lock.json\'));',
          'assert.equal(lock.packages[\'node_modules/@mnjs/test\'].resolved, \'file:../artifact.tgz\');',
          'assert.equal(lock.packages[\'node_modules/@mnjs/test\'].integrity, \'sha512-\' + createHash(\'sha512\').update(readFileSync(\'../artifact.tgz\')).digest(\'base64\'));',
        ]),
        'throw new Error(\'intentional install stop\');'
      ].join('\n'));
      const result = spawnSync(process.execPath, [script, '--output', output, '--artifact', artifact,
        '--sha256', mismatch ? '0'.repeat(64) : sha256, ...(minimum ? ['--minimum-peers'] : [])], {
        env: { ...process.env, TMPDIR: temporary, TEMP: temporary, TMP: temporary, npm_execpath: npmCli }, encoding: 'utf8'
      });
      assert.equal(result.status, 1);
      const report = JSON.parse(readFileSync(join(output, 'report.json'), 'utf8'));
      assert.equal(report.passed, false);
      assert.equal(report.dependencyProfile, minimum ? 'minimum-peers' : 'locked-examples');
      assert.equal(report.sha256, sha256);
      assert.equal(createHash('sha256').update(readFileSync(join(output, 'original.tgz'))).digest('hex'), sha256);
      if (mismatch) {
        assert.match(report.error, /SHA256 mismatch/);
        assert.deepEqual(report.stages, []);
      } else {
        assert.equal(report.artifactMode, 'supplied');
        assert.deepEqual(report.stages, [{ name: 'extract', passed: true }, { name: 'install', passed: false }]);
        assert.match(readFileSync(join(output, 'install.log'), 'utf8'), /intentional install stop/);
      }
      assert.deepEqual(readdirSync(temporary), []);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
}
