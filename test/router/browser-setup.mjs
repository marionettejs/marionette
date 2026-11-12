import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sha256 } from './artifact.mjs';
import * as browserTypes from '@playwright/test';
import { routerBrowserProjects } from './browser-policy.mjs';

export default async function setup(config) {
  assert.ok(process.env.MARIONETTE_BROWSER_CANDIDATE, 'Run the router tarball verifier with --browser');
  const candidate = JSON.parse(readFileSync(process.env.MARIONETTE_BROWSER_CANDIDATE));
  const router = candidate.routerPackage;
  assert.ok(router, 'Browser certification requires the installed router archive');
  assert.equal(resolve(router.directory), resolve(process.env.MARIONETTE_ROUTER_PACKAGE_DIRECTORY));
  assert.equal(sha256(readFileSync(resolve(router.directory, 'dist/index.js'))), candidate.routerArchive.browserModuleSha256);
  assert.equal(candidate.routerArchive.publishableManifest, true);
  const versions = {};
  for (const { use } of routerBrowserProjects) {
    const browser = await browserTypes[use.browserName].launch({ headless: true, ...use.launchOptions });
    try { versions[use.browserName] = browser.version(); } finally { await browser.close(); }
  }
  config.metadata.routerBrowserVersions = versions;
}
