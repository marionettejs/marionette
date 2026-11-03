import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const coverageRequire = createRequire(require.resolve('c8/package.json'));
const excludeRequire = createRequire(coverageRequire.resolve('test-exclude'));

test('coverage matching bounds optimizer amplification without losing files', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'mnjs-minimatch-security-'));
  try {
    mkdirSync(join(fixture, 'nested'));
    writeFileSync(join(fixture, 'one.js'), '');
    writeFileSync(join(fixture, 'nested/two.js'), '');
    writeFileSync(join(fixture, 'nested/three.ts'), '');
    // GHSA-g3hv-75wg-m249: test the actual coverage dependency, including
    // glob's bundled entry point. Overriding only minimatch leaves that bundle old.
    // Keep the adversarial compilation in a child with memory and time bounds.
    const source = `
      const assert = require('node:assert/strict');
      const { Minimatch } = require(${JSON.stringify(require.resolve('minimatch'))});
      const pattern = Array(20).fill('**/../a/b').join('/');
      new Minimatch(pattern, { optimizationLevel: 2, braceExpandMax: 8 });
      for (const modulePath of ${JSON.stringify([excludeRequire.resolve('glob'), excludeRequire.resolve('glob/raw')])}) {
        const { Glob, globSync } = require(modulePath);
        new Glob(pattern, { braceExpandMax: 8 });
        assert.deepEqual(globSync('**/*.js', { nodir: true }).sort(), ['nested/two.js', 'one.js']);
      }
      console.log('bounded preprocessing and file discovery passed');
    `;
    const output = execFileSync(process.execPath,
      ['--max-old-space-size=128', '--input-type=commonjs', '-e', source],
      { cwd: fixture, encoding: 'utf8', timeout: 10000, maxBuffer: 16 * 1024 });
    assert.match(output, /bounded preprocessing and file discovery passed/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
