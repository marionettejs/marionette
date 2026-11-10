import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Build an independent documentation dependency, not a coordinated core release.
// Its own workflow owns the full renderer test suite.
const root = resolve(import.meta.dirname, '../..');
const directory = resolve(root, 'packages/html');
const output = resolve(directory, 'artifacts');
const npm = process.env.npm_execpath;
assert(npm, 'Run through npm run docs:prepare-html');
mkdirSync(output, { recursive: true });
for (const args of [['ci', '--ignore-scripts', '--no-audit', '--no-fund'], ['run', 'build']]) {
  execFileSync(process.execPath, [npm, ...args], { cwd: directory, stdio: 'inherit' });
}
const packed = JSON.parse(execFileSync(process.execPath, [npm, 'pack', '--json', '--ignore-scripts',
  '--pack-destination', output], { cwd: directory, encoding: 'utf8' }));
const manifest = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'));
assert.equal(packed.length, 1);
assert.equal(packed[0].name, manifest.name);
assert.equal(packed[0].version, manifest.version);
console.log(`Prepared documentation renderer: ${resolve(output, packed[0].filename)}`);
