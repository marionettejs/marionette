import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

function comparisonInputs(report) {
  const runner = report?.runner;
  return {
    schemaVersion: report?.schemaVersion,
    fixture: report?.fixture,
    harness: report?.artifacts?.['scripts/performance/browser.mjs'],
    profile: report?.profile,
    runner: Object.fromEntries([
      'browser', 'browserVersion', 'headless', 'accessibilityInstrumentation',
      'monitorViewEvents', 'runOrder', 'workloadTimeoutMilliseconds', 'samples',
      'warmups', 'node', 'npmVersion', 'playwright', 'browserEnvironment'
    ].map(key => [key, runner?.[key]])),
    host: Object.fromEntries(['architecture', 'cpuModel', 'cpuCount', 'platform', 'totalMemoryBytes']
      .map(key => [key, runner?.host?.[key]]))
  };
}

function time(value) { return Number.isFinite(value) && value >= 0 ? `${value.toFixed(2)} ms` : 'Unavailable'; }

function completeInputs(inputs) {
  return inputs.schemaVersion === 1 && Boolean(inputs.fixture?.entrySha256) &&
    Boolean(inputs.fixture?.manifestSha256) && Boolean(inputs.harness) &&
    Object.values(inputs.runner).every(value => value !== undefined) &&
    Object.values(inputs.host).every(value => value !== undefined) &&
    ['deviceMemoryGiB', 'hardwareConcurrency', 'userAgent']
      .every(key => inputs.runner.browserEnvironment?.[key] !== undefined);
}

function inventory(report) {
  const workloads = Array.isArray(report?.workloads) ? report.workloads : [];
  const ids = workloads.map(workload => workload?.id);
  const order = report?.runner?.runOrder;
  const valid = ids.length > 0 && ids.every(id => typeof id === 'string' && id.length > 0) &&
    new Set(ids).size === ids.length && isDeepStrictEqual(ids, order);
  return { workloads, ids, valid };
}

function completeWorkload(workload) {
  return workload?.configuration != null &&
    ['medianMilliseconds', 'p95Milliseconds'].every(key =>
      Number.isFinite(workload?.summary?.[key]) && workload.summary[key] >= 0);
}
function change(base, current) {
  if (base === 0) { return 'Non-comparable: zero baseline'; }
  const percent = (current - base) / base * 100;
  return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
}

export function createBrowserReport(base, current) {
  const baseInventory = inventory(base);
  const currentInventory = inventory(current);
  const sameInventory = baseInventory.valid && currentInventory.valid &&
    isDeepStrictEqual(baseInventory.ids, currentInventory.ids);
  const baseInputs = comparisonInputs(base);
  const currentInputs = comparisonInputs(current);
  const complete = completeInputs(baseInputs) && completeInputs(currentInputs) &&
    [...baseInventory.workloads, ...currentInventory.workloads].every(completeWorkload);
  const matched = complete && sameInventory &&
    base?.profile === 'baseline' && current?.profile === 'baseline' &&
    current?.runner?.samples >= 25 && current?.runner?.warmups >= 5 &&
    isDeepStrictEqual(baseInputs, currentInputs);
  const rows = [];
  const ids = new Set([...currentInventory.ids, ...baseInventory.ids]);
  for (const id of ids) {
    const previousCases = baseInventory.workloads.filter(workload => workload?.id === id);
    const currentCases = currentInventory.workloads.filter(workload => workload?.id === id);
    const count = Math.max(previousCases.length, currentCases.length);
    for (let index = 0; index < count; index += 1) {
      const previous = previousCases[index];
      const workload = currentCases[index];
      const comparable = matched &&
        isDeepStrictEqual(previous?.configuration, workload?.configuration);
      const median = workload?.summary?.medianMilliseconds;
      const p95 = workload?.summary?.p95Milliseconds;
      const status = !workload ? 'Removed' : previous ? 'Non-comparable' : 'New';
      const label = `${id || 'Missing workload ID'}${count > 1 ? ` (duplicate ${index + 1})` : ''}`;
      rows.push(`| ${label} | ${JSON.stringify(workload?.configuration ?? previous?.configuration ?? null)} | ${time(previous?.summary?.medianMilliseconds)} | ${time(median)} (${comparable ? change(previous.summary.medianMilliseconds, median) : status}) | ${time(previous?.summary?.p95Milliseconds)} | ${time(p95)} (${comparable ? change(previous.summary.p95Milliseconds, p95) : status}) |`);
    }
  }
  const runner = current?.runner;
  return [
    '',
    '### Browser timing — native v5',
    '',
    `Environment: ${runner?.browser ?? 'unknown'} ${runner?.browserVersion ?? 'unknown'}, ${runner?.headless === undefined ? 'unknown mode' : runner.headless ? 'headless' : 'headed'}; ${runner?.warmups ?? 'unknown'} warmups and ${runner?.samples ?? 'unknown'} retained samples (${current?.profile ?? 'unknown'} profile).`,
    ...(!sameInventory ? ['Non-comparable: inventory mismatch (missing, duplicate, reordered, or changed workloads versus the recorded manifest run order).'] : []),
    ...(!complete ? ['Non-comparable: incomplete or unsupported report metadata or workload summaries; unavailable measurements are not zero.'] : []),
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
