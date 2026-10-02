import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { releasePackages } from '../../scripts/release/packages.mjs';
import { artifactSetupCommand } from './quick-start.mjs';

const root = resolve(import.meta.dirname, '../..');
const version = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version;
const packages = releasePackages.map(pkg => ({ name: pkg.name, version,
  file: `${pkg.name.replace(/^@/, '').replace('/', '-')}-${version}.tgz` }));
const docs = readFileSync(resolve(root, 'docs/quick-start.md'), 'utf8');
const setup = docs.match(/```sh\n([\s\S]*?)```/)[1];

test('quick-start certification replaces exact release npm specs with supplied artifact bytes', () => {
  const command = artifactSetupCommand(setup, packages);
  for (const pkg of packages.filter(value => value.name !== '@mnjs/data')) {
    assert(command.includes(`'../marionette-v5-artifacts/${pkg.file}'`), pkg.name);
    assert(!command.includes(`${pkg.name}@${version}`), pkg.name);
  }
  assert(command.includes('lit-html@3.3.3'));
  assert(command.includes('vite@8.3.0'));
  assert(!command.includes('mnjs-data-'));
  assert(!docs.includes('.tgz'), 'consumer installation uses npm package versions');
  const data = readFileSync(resolve(root, 'docs/integrations/setup.md'), 'utf8');
  assert(data.includes(`npm install --ignore-scripts --save-exact @mnjs/data@${version}`));
});

test('certification rejects missing, repeated and mismatched release npm specs', () => {
  const spec = `marionette@${version}`;
  for (const command of [setup.replace(spec, 'marionette@latest'), setup.replace(spec, ''),
    setup.replace(spec, `${spec} ${spec}`)]) {
    assert.throws(() => artifactSetupCommand(command, packages), /Quick start must pin/);
  }
  assert.throws(() => artifactSetupCommand(setup, packages.filter(pkg => pkg.name !== 'marionette')),
    /One candidate artifact required/);
  assert.throws(() => artifactSetupCommand(`${setup}\nnpm install @mnjs/data@${version}`, packages),
    /keeps observable data optional/);
});
