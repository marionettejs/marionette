import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createBrowserReport } from '../../scripts/performance/browser-report.mjs';

function fixture() {
  return {
    schemaVersion: 1, profile: 'baseline', fixture: { entrySha256: 'entry', manifestSha256: 'manifest' },
    artifacts: { 'scripts/performance/browser.mjs': 'runner' },
    runner: { browser: 'chromium', browserVersion: '153', headless: true,
      samples: 25, warmups: 5, node: '24', npmVersion: '11', playwright: '1.63',
      accessibilityInstrumentation: false, monitorViewEvents: true,
      runOrder: ['list'], workloadTimeoutMilliseconds: 10000,
      browserEnvironment: { deviceMemoryGiB: 8, hardwareConcurrency: 8, userAgent: 'Chromium' },
      host: { platform: 'linux', cpuModel: 'cpu', architecture: 'x64', cpuCount: 8, totalMemoryBytes: 1000 } },
    workloads: [{ id: 'list', configuration: { listSize: 250 },
      summary: { medianMilliseconds: 10, p95Milliseconds: 20 } }]
  };
}

test('browser report compares matched full samples independently of built artifact hashes', () => {
  const base = fixture();
  const current = fixture();
  current.artifacts['dist/marionette.js'] = 'new-build';
  current.workloads[0].summary.medianMilliseconds = 12;
  assert.match(createBrowserReport(base, current), /12.00 ms \(\+20.00%\)/);
  assert.match(createBrowserReport(base, current), /not a controlled performance baseline/);
});

test('browser report rejects changed measurement inputs and validation samples', () => {
  for (const mutate of [
    value => { value.fixture.entrySha256 = 'changed'; },
    value => { value.artifacts['scripts/performance/browser.mjs'] = 'changed'; },
    value => { value.profile = 'validation'; },
    value => { value.runner.samples = 2; },
    value => { value.runner.warmups = 1; },
    value => { value.runner.browserVersion = '154'; },
    value => { value.runner.host.cpuModel = 'other'; },
    value => { value.runner.browserEnvironment.hardwareConcurrency = 16; },
    value => { value.runner.browserEnvironment.deviceMemoryGiB = 4; },
    value => { value.runner.browserEnvironment.userAgent = 'other'; },
    value => { value.workloads[0].configuration.listSize = 500; },
  ]) {
    const current = fixture();
    mutate(current);
    const report = createBrowserReport(fixture(), current);
    assert.match(report, /Non-comparable/);
    assert.doesNotMatch(report, /\([+-][\d.]+%\)/);
  }
  const validation = fixture();
  validation.profile = 'validation';
  assert.match(createBrowserReport(validation, validation), /Non-comparable/);
});

test('browser report identifies new cases and zero baselines without invalid deltas', () => {
  const base = fixture();
  const current = fixture();
  current.workloads[0].id = 'new';
  assert.match(createBrowserReport(base, current), /\(New\)/);
  base.workloads[0].summary.medianMilliseconds = 0;
  const report = createBrowserReport(base, fixture());
  assert.match(report, /zero baseline/);
  assert.doesNotMatch(report, /Infinity|NaN/);
});


test('browser report retains missing and duplicate inventory records without percentages', () => {
  for (const mutate of [
    value => { value.workloads.push(structuredClone(value.workloads[0])); },
    value => { value.workloads.push({ ...value.workloads[0], id: 'extra' }); },
    value => { value.workloads = []; },
    value => { value.runner.runOrder = ['list', 'missing']; },
  ]) {
    for (const side of ['base', 'current']) {
      const reports = { base: fixture(), current: fixture() };
      mutate(reports[side]);
      const report = createBrowserReport(reports.base, reports.current);
      assert.match(report, /Non-comparable: inventory mismatch/);
      assert.doesNotMatch(report, /\([+-][\d.]+%\)/);
      if (reports[side].workloads.length === 2) {
        assert.equal(report.split('\n').filter(line => /^\| (list|extra)/.test(line)).length, 2);
      }
    }
  }
  const current = fixture();
  current.workloads = [];
  assert.match(createBrowserReport(fixture(), current), /list.*Removed/);
});

test('browser report renders incomplete JSON report shapes as unavailable, never zero or comparable', () => {
  for (const mutate of [
    value => { delete value.artifacts; },
    value => { delete value.runner; },
    value => { delete value.runner.host; },
    value => { delete value.runner.browserEnvironment; },
    value => { delete value.fixture; },
    value => { delete value.workloads; },
    value => { delete value.workloads[0].summary; },
    value => { value.workloads[0].summary.p95Milliseconds = null; },
    value => { value.workloads[0] = null; },
  ]) {
    const incomplete = fixture();
    mutate(incomplete);
    for (const [base, current] of [[incomplete, fixture()], [fixture(), incomplete], [incomplete, incomplete]]) {
      const report = createBrowserReport(base, current);
      assert.match(report, /Non-comparable/);
      assert.doesNotMatch(report, /\([+-][\d.]+%\)|NaN|undefined|Infinity/);
    }
  }
  assert.match(createBrowserReport(null, null), /Non-comparable/);
});


test('browser report CLI keeps incomplete metadata reportable but rejects unreadable evidence', async() => {
  const directory = await mkdtemp(join(tmpdir(), 'browser-report-'));
  try {
    const base = join(directory, 'base.json');
    const current = join(directory, 'current.json');
    await writeFile(base, '{}');
    await writeFile(current, JSON.stringify(fixture()));
    const command = [fileURLToPath(new URL('../../scripts/performance/browser-report.mjs', import.meta.url)), base, current];
    const report = spawnSync(process.execPath, command, { encoding: 'utf8' });
    assert.equal(report.status, 0, report.stderr);
    assert.match(report.stdout, /Browser timing.*[\s\S]*Non-comparable/);
    await writeFile(base, '{');
    const invalid = spawnSync(process.execPath, command, { encoding: 'utf8' });
    assert.equal(invalid.status, 1);
    assert.equal(invalid.stdout, '');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
