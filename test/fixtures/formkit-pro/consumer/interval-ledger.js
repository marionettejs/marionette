// Test-only bridge: install before Pro imports, since Pro caches setInterval.
// Cached bridge calls become native pass-through once a recording finishes.
export function createIntervalBridge(target, installEarly = false) {
  const originalSet = target.setInterval; const originalClear = target.clearInterval;
  const bootstrapRegistrations = [];
  let observer = null; let bootstrapping = installEarly;
  function set(callback, delay, ...args) {
    if (observer) { return observer.set(this, callback, delay, args); }
    if (bootstrapping) { bootstrapRegistrations.push({ delay: Number(delay) }); }
    return Reflect.apply(originalSet, this, [callback, delay, ...args]);
  }
  function clear(handle) {
    observer?.clear(handle);
    return Reflect.apply(originalClear, this, [handle]);
  }
  function install() {
    if (![originalSet, set].includes(target.setInterval) || ![originalClear, clear].includes(target.clearInterval)) {
      throw new Error('Another timer observer owns this context.');
    }
    target.setInterval = set; target.clearInterval = clear;
  }
  if (installEarly) { install(); }
  return {
    start() {
      if (observer) { throw new Error('An interval recording is already active.'); }
      install(); bootstrapping = false;
      const active = new Map(); const records = [];
      let scope = null;
      observer = {
        set(receiver, callback, delay, args) {
          const record = { serial: records.length + 1, scope, delay: Number(delay), ticks: 0, active: true, cleared: false };
          const wrapped = typeof callback === 'function' ? function(...values) { record.ticks++; return Reflect.apply(callback, this, values); } : callback;
          const handle = Reflect.apply(originalSet, receiver, [wrapped, delay, ...args]);
          records.push(record); active.set(handle, record); return handle;
        },
        clear(handle) {
          const record = active.get(handle);
          if (record) { record.active = false; record.cleared = true; active.delete(handle); }
        }
      };
      return {
        capture(label, operation) { const previous = scope; scope = label; try { return operation(); } finally { scope = previous; } },
        rows: () => records.map(record => ({ ...record })),
        bootstrap: () => bootstrapRegistrations.map(record => ({ ...record })),
        finish() {
          let collectorCleared = 0;
          for (const [handle, record] of active) {
            if (record.scope !== null) { Reflect.apply(originalClear, target, [handle]); active.delete(handle); collectorCleared++; }
          }
          observer = null;
          const restored = target.setInterval === set && target.clearInterval === clear;
          if (target.setInterval === set) { target.setInterval = originalSet; }
          if (target.clearInterval === clear) { target.clearInterval = originalClear; }
          return { collectorCleared, restored, recordingDetached: observer === null };
        }
      };
    }
  };
}
