import assert from 'node:assert/strict';

const durations = ['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration'];

export function deltaMetrics(before, after) {
  const toMap = result => new Map(result.metrics.map(({ name, value }) => [name, value]));
  const beforeMetrics = toMap(before);
  const afterMetrics = toMap(after);
  return Object.fromEntries(durations.map(name => {
    assert.ok(Number.isFinite(beforeMetrics.get(name)) && Number.isFinite(afterMetrics.get(name)), `Missing CDP duration ${name}`);
    const elapsed = afterMetrics.get(name) - beforeMetrics.get(name);
    assert.ok(elapsed >= 0, `CDP duration reset: ${name}`);
    return [name, elapsed * 1000];
  }));
}

export async function observedMemory(cdp, collect = false) {
  if (collect) { await cdp.send('HeapProfiler.collectGarbage'); }
  const { usedSize, totalSize, embedderHeapUsedSize, backingStorageSize } = await cdp.send('Runtime.getHeapUsage');
  const { documents, nodes, jsEventListeners } = await cdp.send('Memory.getDOMCounters');
  return { jsHeapUsedBytes: usedSize, jsHeapCapacityBytes: totalSize, embedderHeapUsedSize, backingStorageSize,
    documents, nodes, jsEventListeners, collected: collect };
}
