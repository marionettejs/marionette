import { afterEach, expect, it, vi } from 'vitest';
import { createIntervalBridge } from '../fixtures/formkit-pro/consumer/interval-ledger.js';
import { runLifecycle } from '../fixtures/formkit-pro/consumer/lifecycle-01307.js';

afterEach(() => { vi.useRealTimers(); document.body.replaceChildren(); });
function plugin(mode) {
  const handles = new Set();
  return node => {
    const acquire = () => {
      const handle = setInterval(() => {}, 4000);
      handles.add(handle);
      if (mode === 'clean' || mode === 'async') { node.on('destroyed', () => clearInterval(handle)); }
      if (mode === 'clear-all') { node.on('destroyed', () => handles.forEach(clearInterval)); }
    };
    if (mode === 'async') { queueMicrotask(acquire); } else { acquire(); }
  };
}
async function collect(chosen) {
  vi.useFakeTimers();
  return runLifecycle({ plugins: [chosen], probeInputType: 'text', wait: ms => vi.advanceTimersByTimeAsync(ms) });
}

it('observes acquired timer cleanup while live survivors keep their original running timers', async() => {
  const result = await collect(plugin('clean'));
  expect(result.executionError).toBeUndefined();
  expect(result.checks.filter(check => !check.passed)).toEqual([]);
  expect(result.passed).toBe(true);
  expect(result.observationComplete).toBe(true);
  expect(result.garbageCollectionMeasured).toBe(false);
  expect(result.intervals.every(record => record.cleared && !record.active && record.ticks > 0)).toBe(true);
  expect(result.collectorCleanup).toEqual({ collectorCleared: 0, restored: true, recordingDetached: true, cleanupErrors: 0 });
});

it('fails a missing-cleanup control before collector cleanup can hide its live handles', async() => {
  const result = await collect(plugin('leak'));
  expect(result.executionError).toBeUndefined();
  expect(result.passed).toBe(false);
  expect(result.checks.some(check => check.name.startsWith('destroyed ') && !check.passed)).toBe(true);
  expect(result.intervals.some(record => record.active && !record.cleared)).toBe(true);
  expect(result.collectorCleanup.collectorCleared).toBeGreaterThan(0);
});

it('fails indiscriminate clearing even when the destroyed nodes have no remaining timers', async() => {
  const result = await collect(plugin('clear-all'));
  expect(result.executionError).toBeUndefined();
  expect(result.passed).toBe(false);
  expect(result.checks.some(check => check.name.startsWith('survivor retained after teardown') && !check.passed)).toBe(true);
});

it('does not certify a plugin that never exercises the target acquisition', async() => {
  const result = await collect(() => {});
  expect(result.passed).toBe(false);
  expect(result.observationComplete).toBe(false);
  expect(result.checks.some(check => check.name === 'required timer cohorts exercised' && !check.passed)).toBe(true);
});

it('marks asynchronous unscoped registrations incomplete rather than assigning them to a guessed owner', async() => {
  const result = await collect(plugin('async'));
  expect(result.passed).toBe(false);
  expect(result.observationComplete).toBe(false);
  expect(result.intervals.some(record => record.scope === null)).toBe(true);
});

it('restores timer instrumentation after a collector operation fails without promising constructor rollback', async() => {
  vi.useFakeTimers();
  const originalSet = globalThis.setInterval;
  const originalClear = globalThis.clearInterval;
  const failed = await runLifecycle({ plugins: [plugin('clean')], probeInputType: 'text', wait: () => { throw new Error('Fixture wait failure'); } });
  expect(failed.passed).toBe(false);
  expect(failed.executionError).toBe('Error');
  expect(globalThis.setInterval).toBe(originalSet);
  expect(globalThis.clearInterval).toBe(originalClear);
  const next = await runLifecycle({ plugins: [plugin('clean')], probeInputType: 'text', wait: ms => vi.advanceTimersByTimeAsync(ms) });
  expect(next.passed).toBe(true);
});

it('records cached timer aliases across recordings and detaches recording between them', async() => {
  vi.useFakeTimers();
  const original = globalThis.setInterval;
  const bridge = createIntervalBridge(globalThis, true);
  const cachedSet = globalThis.setInterval;
  const first = bridge.start();
  const ticks = [];
  const handle = first.capture('first', () => cachedSet(value => ticks.push(value), 4000, 'first'));
  await vi.advanceTimersByTimeAsync(4000);
  expect(ticks).toEqual(['first']);
  expect(first.rows()).toEqual([{ serial: 1, scope: 'first', delay: 4000, ticks: 1, active: true, cleared: false }]);
  clearInterval(handle);
  expect(first.finish()).toEqual({ collectorCleared: 0, restored: true, recordingDetached: true });
  expect(globalThis.setInterval).toBe(original);
  const unobserved = cachedSet(() => ticks.push('outside'), 4000);
  await vi.advanceTimersByTimeAsync(4000);
  clearInterval(unobserved);
  expect(first.rows()).toHaveLength(1);
  const second = bridge.start();
  const next = second.capture('second', () => cachedSet(() => ticks.push('second'), 4000));
  await vi.advanceTimersByTimeAsync(4000);
  clearInterval(next);
  expect(second.rows()).toEqual([{ serial: 1, scope: 'second', delay: 4000, ticks: 1, active: false, cleared: true }]);
  expect(second.finish().restored).toBe(true);
  expect(ticks).toEqual(['first', 'outside', 'second']);
});

it('accepts exercised timer cohorts without requiring an interval on every native node', async() => {
  const clean = plugin('clean');
  const result = await collect(node => {
    if (['choice', 'temporary'].includes(String(node.name))) { clean(node); }
  });
  expect(result.executionError).toBeUndefined();
  expect(result.observationComplete).toBe(true);
  expect(result.passed).toBe(true);
  expect(result.intervals).toHaveLength(5);
  expect(result.checks.some(check => check.name.startsWith('live ') && check.actual.timers === 0 && check.passed)).toBe(true);
});
