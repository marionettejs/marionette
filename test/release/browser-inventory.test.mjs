import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../..');

test('release browser inventory matches every current Playwright case and engine', () => {
  const inventory = JSON.parse(readFileSync(resolve(root, 'config/release-validation.json'), 'utf8'));
  const profile = JSON.parse(readFileSync(resolve(root, 'config/release-profile.json'), 'utf8'));
  const report = JSON.parse(execFileSync(process.execPath, [
    fileURLToPath(import.meta.resolve('@playwright/test/cli')), 'test', '--list', '--reporter=json'
  ], { cwd: root, encoding: 'utf8', timeout: 30_000, maxBuffer: 10 * 1024 * 1024 }));
  assert.deepEqual(report.errors, []);
  const actual = [];
  function visit(suites) {
    for (const suite of suites) {
      for (const spec of suite.specs || []) {
        for (const item of spec.tests) {
          actual.push(JSON.stringify([spec.file, spec.title, item.projectName]));
        }
      }
      visit(suite.suites || []);
    }
  }
  visit(report.suites);
  const expected = inventory.browserTests.flatMap(({ file, title }) =>
    profile.browsers.playwright.browserBuilds.map(({ name }) => JSON.stringify([file, title, name])));
  assert.deepEqual(actual.sort(), expected.sort());
});
