import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import browserslist from 'browserslist';

const root = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const profile = await readJson('config/release-profile.json');
const packageJson = await readJson('package.json');
const packageLock = await readJson('package-lock.json');
const browserProfile = profile.browsers;
const playwrightProfile = browserProfile.playwright;

function fail(message) {
  console.error(`Browser profile mismatch: ${message}`);
  process.exitCode = 1;
}

async function readJson(file) {
  return JSON.parse(await readFile(resolve(root, file), 'utf8'));
}

function validatePackagePin() {
  const packageName = playwrightProfile.package;
  const expectedVersion = playwrightProfile.version;
  const manifestVersion = packageJson.devDependencies?.[packageName];
  const lockVersion = packageLock.packages?.[`node_modules/${packageName}`]?.version;
  const lockedManifestVersion = packageLock.packages?.['']?.devDependencies?.[packageName];

  if (manifestVersion !== expectedVersion) {
    fail(`${packageName} is ${manifestVersion}; expected ${expectedVersion}`);
  }
  if (lockedManifestVersion !== expectedVersion) {
    fail(`lockfile declares ${packageName} ${lockedManifestVersion}; expected ${expectedVersion}`);
  }
  if (lockVersion !== expectedVersion) {
    fail(`lockfile resolves ${packageName} ${lockVersion}; expected ${expectedVersion}`);
  }
}

async function validateBrowserBuilds() {
  const playwrightCorePackage = require.resolve('playwright-core/package.json');
  const installedCore = JSON.parse(await readFile(playwrightCorePackage, 'utf8'));
  const installedBrowsers = JSON.parse(await readFile(
    resolve(dirname(playwrightCorePackage), 'browsers.json'),
    'utf8'
  )).browsers;

  if (installedCore.version !== playwrightProfile.version) {
    fail(`playwright-core is ${installedCore.version}; expected ${playwrightProfile.version}`);
  }

  for (const expected of playwrightProfile.browserBuilds) {
    const actual = installedBrowsers.find(browser => browser.name === expected.name);
    if (!actual) {
      fail(`playwright-core does not define ${expected.name}`);
      continue;
    }
    if (actual.browserVersion !== expected.version || actual.revision !== expected.revision) {
      fail(`${expected.name} is ${actual.browserVersion} revision ${actual.revision}; ` +
        `expected ${expected.version} revision ${expected.revision}`);
    }
  }
}

function validateTranspilationTargets() {
  const actualTargets = browserslist(packageJson.browserslist);
  const expectedTargets = browserProfile.transpilationTargets;

  if (JSON.stringify(actualTargets) !== JSON.stringify(expectedTargets)) {
    fail(`transpilation targets are ${actualTargets.join(', ')}; expected ${expectedTargets.join(', ')}`);
  }
}

validatePackagePin();
await validateBrowserBuilds();
validateTranspilationTargets();

if (!process.exitCode) {
  console.log(`Browser profile verified: Playwright ${playwrightProfile.version}; ` +
    `${browserProfile.transpilationTargets.length} transpilation targets.`);
}
