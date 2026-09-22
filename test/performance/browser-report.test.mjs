import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBrowserReport } from '../../scripts/performance/browser-report.mjs';

function fixture() {
  return {
    schemaVersion: 1, profile: 'baseline', fixture: { entrySha256: 'entry', manifestSha256: 'manifest' },
    artifacts: { 'scripts/performance/browser.mjs': 'runner' },
    runner: { browser: 'chromium', browserVersion: '153', headless: true,
      samples: 25, warmups: 5, node: '24', host: { platform: 'linux', cpuModel: 'cpu' } },
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
