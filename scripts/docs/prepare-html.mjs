import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Verify examples against the independently published renderer, not a rebuilt
// checkout candidate. Runtime candidate checks belong to the HTML workflow.
const root = resolve(import.meta.dirname, '../..');
const directory = resolve(root, 'packages/html');
const output = resolve(directory, 'artifacts');
const npm = process.env.npm_execpath;
assert(npm, 'Run through npm run docs:prepare-html');
mkdirSync(output, { recursive: true });
const manifest = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'));
const packed = JSON.parse(execFileSync(process.execPath, [npm, 'pack', `${manifest.name}@${manifest.version}`, '--json', '--ignore-scripts',
  '--pack-destination', output], { cwd: root, encoding: 'utf8' }));
assert.equal(packed.length, 1);
assert.equal(packed[0].name, manifest.name);
assert.equal(packed[0].version, manifest.version);
console.log(`Prepared documentation renderer: ${resolve(output, packed[0].filename)}`);
