import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

function comparisonInputs(report) {
  const { runner } = report;
  return {
    schemaVersion: report.schemaVersion,
    fixture: report.fixture,
    harness: report.artifacts['scripts/performance/browser.mjs'],
    profile: report.profile,
    runner: Object.fromEntries([
      'browser', 'browserVersion', 'headless', 'accessibilityInstrumentation',
      'monitorViewEvents', 'runOrder', 'workloadTimeoutMilliseconds', 'samples',
      'warmups', 'node', 'npmVersion', 'playwright'
    ].map(key => [key, runner[key]])),
    host: Object.fromEntries(['architecture', 'cpuModel', 'cpuCount', 'platform', 'totalMemoryBytes']
      .map(key => [key, runner.host[key]]))
  };
}

function time(value) { return `${value.toFixed(2)} ms`; }
function change(base, current) {
  if (base === 0) { return 'Non-comparable: zero baseline'; }
  const percent = (current - base) / base * 100;
  return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
}

export function createBrowserReport(base, current) {
  const baseCases = new Map(base.workloads.map(workload => [workload.id, workload]));
  const matched = base.profile === 'baseline' && current.profile === 'baseline' &&
    current.runner.samples >= 25 && current.runner.warmups >= 5 &&
    Boolean(current.fixture.entrySha256) &&
    Boolean(current.artifacts['scripts/performance/browser.mjs']) &&
    isDeepStrictEqual(comparisonInputs(base), comparisonInputs(current));
  const rows = current.workloads.map(workload => {
    const previous = baseCases.get(workload.id);
    const comparable = matched && previous &&
      isDeepStrictEqual(previous.configuration, workload.configuration);
    const median = workload.summary.medianMilliseconds;
    const p95 = workload.summary.p95Milliseconds;
    const status = previous ? 'Non-comparable' : 'New';
    return `| ${workload.id} | ${JSON.stringify(workload.configuration)} | ${previous ? time(previous.summary.medianMilliseconds) : '—'} | ${time(median)} (${comparable ? change(previous.summary.medianMilliseconds, median) : status}) | ${previous ? time(previous.summary.p95Milliseconds) : '—'} | ${time(p95)} (${comparable ? change(previous.summary.p95Milliseconds, p95) : status}) |`;
  });
  return [
    '',
    '### Browser timing — native v5',
    '',
    `Environment: ${current.runner.browser} ${current.runner.browserVersion}, ${current.runner.headless ? 'headless' : 'headed'}; ${current.runner.warmups} warmups and ${current.runner.samples} retained samples (${current.profile} profile).`,
    'Durations are per complete workload with the configuration shown: list reconciliation, Application restart/destruction, or state mount/update/destruction. These are not per-operation jsdom timings.',
    '',
    '| Case | Configuration | Base median | PR median | Base p95 | PR p95 |',
    '| --- | --- | ---: | ---: | ---: | ---: |',
    ...rows,
    '',
    'Reporting only on shared hardware; this is not a controlled performance baseline. Changed fixtures, harness, workload settings, browser, host configuration, or sampling profiles are non-comparable. Validation profiles never produce percentage comparisons.',
    ''
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [base, current] = await Promise.all(process.argv.slice(2, 4)
      .map(async file => JSON.parse(await readFile(file, 'utf8'))));
    console.log(createBrowserReport(base, current));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
