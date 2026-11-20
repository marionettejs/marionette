import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function cypressInstallArguments(profile, manifest, lock) {
  assert(['current', '14.0.0'].includes(profile), 'Choose the current or Cypress 14.0.0 profile.');
  const current = manifest.devDependencies?.cypress;
  assert.equal(typeof current, 'string', 'The examples must declare Cypress.');
  assert(current === current.trim() && /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(current),
    'Cypress must use an exact release version.');
  assert.equal(lock.packages?.['']?.devDependencies?.cypress, current,
    'The examples manifest and root lock entry must agree on Cypress.');
  assert.equal(lock.packages?.['node_modules/cypress']?.version, current,
    'The locked Cypress package must match the examples manifest.');
  const version = profile === 'current' ? current : '14.0.0';
  return ['exec', '--yes', '--ignore-scripts', `--package=cypress@${version}`, '--', 'cypress', 'install'];
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const manifest = JSON.parse(readFileSync(new URL('../../packages/test/examples/package.json', import.meta.url)));
  const lock = JSON.parse(readFileSync(new URL('../../packages/test/examples/package-lock.json', import.meta.url)));
  const args = cypressInstallArguments(process.env.MNJS_TEST_CYPRESS_PROFILE, manifest, lock);
  console.log(`Installing checked Cypress profile ${process.env.MNJS_TEST_CYPRESS_PROFILE}: ${args[3]}`);
  const result = spawnSync('npm', args, { stdio: 'inherit' });
  if (result.error) { throw result.error; }
  process.exitCode = result.status ?? 1;
}
