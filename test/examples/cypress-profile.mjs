import assert from 'node:assert/strict';

export function cypressProfile(profile, manifest, lock, floorFlag = false) {
  assert(['current', '14.0.0'].includes(profile), 'Choose the current or Cypress 14.0.0 profile.');
  assert(!floorFlag || profile === '14.0.0', 'The Cypress profile and floor flag must agree.');
  const current = manifest.devDependencies?.cypress;
  assert.equal(typeof current, 'string', 'The examples must declare Cypress.');
  assert(current === current.trim() && /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(current),
    'Cypress must use an exact release version.');
  assert.equal(lock.packages?.['']?.devDependencies?.cypress, current,
    'The examples manifest and root lock entry must agree on Cypress.');
  assert.equal(lock.packages?.['node_modules/cypress']?.version, current,
    'The locked Cypress package must match the examples manifest.');
  return { version: profile === 'current' ? current : profile, floor: profile === '14.0.0' };
}
