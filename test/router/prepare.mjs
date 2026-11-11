import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { candidateOutput, inspectRouterArchive, sha256 } from './artifact.mjs';

const root = resolve(import.meta.dirname, '../..');
const { values } = parseArgs({ options: { output: { type: 'string' } } });
assert.ok(values.output, 'Pass --output with a new directory outside the checkout');
const output = candidateOutput(root, values.output);
const npm = process.env.npm_execpath;
assert.ok(npm, 'Run through npm run router:prepare');
const npmVersion = execFileSync(process.execPath, [npm, '--version'], { encoding: 'utf8' }).trim();
const profile = JSON.parse(readFileSync(resolve(root, 'config/release-profile.json')));
assert.equal(process.versions.node, profile.source.node, 'Use the pinned source Node');
assert.equal(npmVersion, profile.source.npm, 'Use the pinned source npm');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
assert.equal(git(['status', '--porcelain', '--untracked-files=all']), '', 'Prepare from clean committed source');
const commit = git(['rev-parse', 'HEAD']);
mkdirSync(output, { recursive: true });
assert.equal(readdirSync(output).length, 0, 'The output directory must be empty');
execFileSync(process.execPath, [npm, 'run', 'build:router'], { cwd: root, stdio: 'inherit' });
const [packed] = JSON.parse(execFileSync(process.execPath, [npm, 'pack', resolve(root, 'packages/router'),
  '--ignore-scripts', '--offline', '--json', '--pack-destination', output], { cwd: root, encoding: 'utf8' }));
const archive = resolve(output, packed.filename);
const identity = inspectRouterArchive(archive, sha256(readFileSync(archive)));
assert.equal(git(['rev-parse', 'HEAD']), commit);
assert.equal(git(['status', '--porcelain', '--untracked-files=all']), '');
const receipt = { schemaVersion: 1, sourceCommit: commit, sourceDirty: false, publishableManifest: true,
  node: process.versions.node, npm: npmVersion, archive: { ...identity, file: packed.filename } };
writeFileSync(resolve(output, 'router-candidate.json'), `${JSON.stringify(receipt, null, 2)}\n`);
writeFileSync(resolve(output, `${packed.filename}.sha256`), `${identity.sha256}  ${packed.filename}\n`);
console.log(JSON.stringify(receipt, null, 2));
