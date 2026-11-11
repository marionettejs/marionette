import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const names = ['chromium', 'firefox', 'webkit'];

export function expectedBrowserBuilds({ manifest, lock, installedVersion, browserDefinitions, profile }) {
  const version = manifest.devDependencies['@playwright/test'];
  assert.equal(lock.packages['node_modules/@playwright/test'].version, version, 'Playwright lock version mismatch');
  assert.equal(lock.packages['node_modules/playwright-core'].version, version, 'Playwright core lock version mismatch');
  assert.equal(installedVersion, version, 'Installed Playwright must match the package being tested');
  if (profile) {
    assert.equal(profile.version, version, 'Playwright must match the root release profile');
    return profile.browserBuilds;
  }
  return names.map(name => ({ name, version: browserDefinitions.find(browser => browser.name === name)?.browserVersion }));
}

// Checking package metadata alone cannot prove that the container's browser
// executables and shared libraries work for the non-root CI user.
export async function verifyProvisionedBrowsers(browserTypes, expectedBuilds) {
  assert.deepEqual(expectedBuilds.map(({ name }) => name), names,
    'The provisioned browser check must cover all three supported engines');
  const versions = [];
  for (const { name, version } of expectedBuilds) {
    assert.equal(typeof version, 'string', `${name} must have an expected browser version`);
    const browser = await browserTypes[name].launch({ headless: true, timeout: 30_000 });
    try {
      const actual = browser.version();
      assert.equal(actual, version, `${name} executable must match the expected package browser version`);
      versions.push(`${name} ${actual}`);
    } finally {
      await browser.close();
    }
  }
  return versions;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: { 'package-dir': { type: 'string', default: '.' } } });
  const root = resolve(import.meta.dirname, '../..');
  const directory = resolve(root, values['package-dir']);
  const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
  const require = createRequire(resolve(directory, 'package.json'));
  const corePath = require.resolve('playwright-core/package.json');
  const installed = await readJson(corePath);
  assert.equal(require('@playwright/test/package.json').version, installed.version,
    'Installed Playwright test and core packages must agree');
  const profile = directory === root ? (await readJson(resolve(root, 'config/release-profile.json'))).browsers.playwright : undefined;
  const expected = expectedBrowserBuilds({
    manifest: await readJson(resolve(directory, 'package.json')),
    lock: await readJson(resolve(directory, 'package-lock.json')),
    installedVersion: installed.version,
    browserDefinitions: (await readJson(resolve(dirname(corePath), 'browsers.json'))).browsers,
    profile,
  });
  const browserTypes = require('@playwright/test');
  const versions = await verifyProvisionedBrowsers(browserTypes, expected);
  console.log(`Provisioned browsers verified: ${versions.join(', ')}.`);
}
