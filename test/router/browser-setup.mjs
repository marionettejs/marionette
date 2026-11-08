import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sha256 } from './artifact.mjs';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';

export default function setup(config) {
  assert.ok(process.env.MARIONETTE_BROWSER_CANDIDATE, 'Run the router tarball verifier with --browser');
  const candidate = JSON.parse(readFileSync(process.env.MARIONETTE_BROWSER_CANDIDATE));
  const router = candidate.routerPackage;
  assert.ok(router, 'Browser certification requires the installed router archive');
  assert.equal(resolve(router.directory), resolve(process.env.MARIONETTE_ROUTER_PACKAGE_DIRECTORY));
  assert.equal(sha256(readFileSync(resolve(router.directory, 'dist/index.js'))), candidate.routerArchive.browserModuleSha256);
  assert.equal(candidate.routerArchive.publicationAllowed, false);
  config.metadata.routerBrowserVersion = execFileSync(process.env.MARIONETTE_ROUTER_CHROMIUM ?? chromium.executablePath(), ['--version'], { encoding: 'utf8' }).trim();
}
