import { captureValue, sameValue } from './commit-snapshot.mjs';
import { pendingInput, watchInputCompletion } from './input-completion.mjs';

const aborted = () => new DOMException('FormKit edit observation ended.', 'AbortError');

export function createFieldCommitTracker(root, metrics, owner) {
  const observers = new Set(), waiters = new Set(), records = new Map(), owned = new Map();
  let releaseOwner = () => {};
  let active = false, dead = false, cycle = 0, revision = 0, source = 'unknown';
  let rootReceipts = [], queue = [], flushScheduled = false, flushing = false, checkScheduled = false;
  const count = name => { if (metrics.enabled) { metrics[name]++; } };
  Object.assign(metrics, { fieldCommitSnapshots: 0, fieldCommitEvents: 0, fieldCommitObservers: 0, pendingEditFences: 0, fieldCommitReceipts: 0 });
  const copy = value => { count('fieldCommitSnapshots'); return captureValue(value); };
  // Core attaches a child before its constructor's initial input/commit. Those
  // known initialization writes are not ordinary unknown-origin edit candidates.
  const originOf = node => source === 'unknown' && node.isCreated === false ? 'programmatic' : source;
  const contributes = node => { for (let current = node; current; current = current.parent) { if (current === root) { return true; } } return false; };
  const receiptsChanged = () => { if (metrics.enabled) { metrics.fieldCommitReceipts = rootReceipts.length + owned.size + [...records.values()].reduce((sum, record) => sum + record.receipts.length, 0); } };
  const pathOf = node => { const path = []; for (let current = node; current !== root; current = current.parent) { if (!current) { return null; } path.unshift(current.name); } return Object.freeze(path); };

  function retire(record) {
    if (!record?.live) { return; } record.live = false; record.input = null; record.snapshot = undefined;
    records.delete(record.node); record.releaseCompletion(); for (const receipt of record.receipts) { record.node.off(receipt); }
    if (owner?.nodes.has(record.node)) { trackOwned(record.node); } receiptsChanged();
  }
  function walk(node, visit) {
    if (!node || typeof node.on !== 'function') { return; } visit(node);
    for (const child of node.children) { walk(child, visit); }
  }
  function stop() {
    if (!active) { return; } active = false; cycle++;
    for (const receipt of rootReceipts) { root.off(receipt); } rootReceipts = [];
    releaseOwner(); releaseOwner = () => {};
    for (const node of [...owned.keys()]) { retireOwned(node); }
    for (const record of [...records.values()]) { retire(record); }
    queue = []; flushScheduled = false; checkScheduled = false; receiptsChanged();
  }
  const stopIfUnused = () => { if (!observers.size && !waiters.size) { stop(); } };
  function close(observer) {
    if (!observer.live) { return; } observer.live = false; observers.delete(observer);
    if (metrics.enabled) { metrics.fieldCommitObservers = observers.size; }
    if (!observers.size) { for (const record of records.values()) { record.snapshot = undefined; record.ready = false; record.input = null; } }
    stopIfUnused(); scheduleCheck();
  }
  function finish(waiter, failed = false, error) {
    if (!waiters.delete(waiter)) { return; }
    try { waiter.signal?.removeEventListener('abort', waiter.abort); } catch (cleanupError) { if (!failed) { failed = true; error = cleanupError; } }
    if (metrics.enabled) { metrics.pendingEditFences = waiters.size; }
    if (failed) { waiter.reject(error); } else { waiter.resolve(); }
  }
  const rejectWaiters = error => { for (const waiter of [...waiters]) { finish(waiter, true, error); } };
  function destroy() {
    if (dead) { return; } dead = true; rejectWaiters(aborted());
    for (const observer of [...observers]) { close(observer); } stop();
  }
  const quiet = () => active && !dead && !queue.length && !flushing && !flushScheduled &&
    [...records.values()].every(record => record.live && record.node.isSettled && !pendingInput(record.node)) &&
    [...owned.keys()].every(node => node.isSettled && !pendingInput(node));
  function canFinish() {
    try { return quiet(); } catch (error) { rejectWaiters(error); stopIfUnused(); return false; }
  }
  function scheduleCheck() {
    if (!active || dead || !waiters.size || checkScheduled) { return; }
    checkScheduled = true; const lifetime = cycle;
    queueMicrotask(() => {
      if (!active || dead || lifetime !== cycle) { return; } checkScheduled = false;
      if (!canFinish()) { return; } const observed = revision;
      queueMicrotask(() => {
        if (!active || dead || lifetime !== cycle) { return; }
        if (observed !== revision || !canFinish()) { scheduleCheck(); return; }
        for (const waiter of [...waiters]) { finish(waiter); } stopIfUnused();
      });
    });
  }
  function scheduleFlush() {
    if (!active || dead || flushScheduled || !queue.length) { return; }
    flushScheduled = true; const lifetime = cycle;
    queueMicrotask(() => {
      if (!active || dead || lifetime !== cycle) { return; }
      flushScheduled = false; flushing = true; const jobs = queue; queue = []; let index = 0;
      try {
        for (; index < jobs.length; index++) {
          const job = jobs[index];
          for (const observer of job.targets) {
            if (!observer.live || !job.record.live || !contributes(job.record.node) || dead) { continue; }
            if (job.failed) { for (const target of job.targets) { close(target); } rejectWaiters(job.error); throw job.error; }
            try {
              const fact = Object.freeze({ node: job.record.node, generation: job.generation, path: job.path, source: job.source,
                changed: job.changed, value: copy(job.value), previous: copy(job.previous) });
              if (!active || dead || lifetime !== cycle || !observer.live || !job.record.live) { continue; }
              Reflect.apply(observer.callback, undefined, [fact]);
            } catch (error) { close(observer); if (lifetime === cycle) { rejectWaiters(error); } throw error; }
          }
        }
      } finally {
        if (active && !dead && lifetime === cycle) { queue = [...jobs.slice(index + 1), ...queue]; }
        flushing = false; scheduleFlush(); scheduleCheck(); stopIfUnused();
      }
    });
  }
  function captureFailure(error, record, targets = [...observers]) {
    queue.push({ failed: true, error, record, targets }); scheduleFlush();
  }
  function track(node) {
    if (!active || dead || !contributes(node)) { return; }
    if (records.has(node)) { return; }
    const record = { node, generation: Symbol('FormKit input lifetime'), live: true, input: null, ready: false, snapshot: undefined, receipts: [], releaseCompletion: () => {} };
    records.set(node, record); retireOwned(node);
    record.releaseCompletion = watchInputCompletion(node, () => { revision++; scheduleCheck(); });
    record.receipts.push(node.on('settled', scheduleCheck));
    record.receipts.push(node.on('destroying', () => {
      if (node === root) { destroy(); } else { walk(node, child => retire(records.get(child))); revision++; scheduleCheck(); }
    }));
    record.receipts.push(node.on('destroyed', () => { if (node === root) { destroy(); } else { retire(record); scheduleCheck(); } }));
    if (observers.size && node.type === 'input' && node !== root) {
      try {
        const value = copy(node.value);
        if (active && !dead && record.live) { record.snapshot = value; record.ready = true; }
      } catch (error) { if (active && !dead && record.live) { captureFailure(error, record); } }
    }
    receiptsChanged();
  }
  function retireOwned(node) {
    const record = owned.get(node);
    if (!record) { return; }
    owned.delete(node); record.release(); node.off(record.receipt); receiptsChanged();
  }
  function trackOwned(node) {
    if (!active || dead || records.has(node) || owned.has(node)) { return; }
    const changed = () => { revision++; scheduleCheck(); };
    const record = { release: watchInputCompletion(node, changed), receipt: node.on('settled', changed) };
    owned.set(node, record); receiptsChanged();
  }
  function start() {
    if (active || dead) { return; } active = true; cycle++;
    try {
      walk(root, node => track(node));
      if (owner && active && !dead) {
        for (const node of owner.nodes) { trackOwned(node); }
        releaseOwner = owner.watch((kind, node) => {
          if (kind === 'add') { trackOwned(node); } else { retireOwned(node); }
          revision++; scheduleCheck();
        });
      }
      rootReceipts.push(root.on('child.deep', event => { walk(event.payload, node => track(node)); revision++; scheduleCheck(); }, 'unshift'));
      rootReceipts.push(root.on('childRemoved.deep', event => { walk(event.payload, node => { if (!contributes(node)) { retire(records.get(node)); } }); revision++; scheduleCheck(); }, 'unshift'));
      rootReceipts.push(root.on('input.deep', event => {
        const record = records.get(event.origin); if (!record?.live || !contributes(event.origin)) { return; }
        revision++;
        if (event.origin.type === 'input' && event.origin !== root) { record.input = observers.size ? { source: originOf(event.origin) } : null; }
        scheduleCheck();
      }));
      rootReceipts.push(root.on('commitRaw.deep', event => {
        const record = records.get(event.origin); if (!record?.live || !contributes(event.origin)) { return; }
        revision++;
        if (event.origin.type === 'input' && event.origin !== root && observers.size) {
          const input = record.input; record.input = null;
          try {
            const value = copy(event.payload), previous = record.snapshot, ready = record.ready;
            if (!active || dead || !record.live) { return; }
            record.snapshot = value; record.ready = true;
            if (ready) {
              const path = pathOf(event.origin);
              if (path) {
                queue.push({ record, generation: record.generation, targets: [...observers], path, source: input?.source ?? originOf(event.origin),
                  value, previous, changed: !sameValue(previous, value) }); count('fieldCommitEvents'); scheduleFlush();
              }
            }
          } catch (error) { if (active && !dead && record.live) { record.ready = false; captureFailure(error, record); } }
        }
        scheduleCheck();
      })); receiptsChanged();
    } catch (error) { try { stop(); } catch { /* Setup retains its original error. */ } throw error; }
  }
  function observe(callback) {
    if (typeof callback !== 'function') { throw new TypeError('observeFieldCommits requires a callback.'); }
    if (dead) { return () => {}; } start(); const lifetime = cycle;
    try {
      for (const record of [...records.values()]) {
        if (record.node.type === 'input' && record.node !== root && !record.ready) {
          const value = copy(record.node.value);
          if (!active || dead || lifetime !== cycle) { return () => {}; }
          if (record.live) { record.snapshot = value; record.ready = true; }
        }
      }
    } catch (error) { stopIfUnused(); throw error; }
    if (!active || dead || lifetime !== cycle) { return () => {}; }
    const observer = { callback, live: true }; observers.add(observer);
    if (metrics.enabled) { metrics.fieldCommitObservers = observers.size; }
    return () => close(observer);
  }
  function whenSettled({ signal } = {}) {
    if (dead) { return Promise.reject(aborted()); }
    if (signal?.aborted) { return Promise.reject(signal.reason === undefined ? aborted() : signal.reason); }
    start();
    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject, signal, abort: null };
      waiter.abort = () => { finish(waiter, true, signal.reason === undefined ? aborted() : signal.reason); stopIfUnused(); };
      waiters.add(waiter); if (metrics.enabled) { metrics.pendingEditFences = waiters.size; }
      try { signal?.addEventListener('abort', waiter.abort, { once: true }); if (signal?.aborted) { waiter.abort(); } } catch (error) { finish(waiter, true, error); stopIfUnused(); return; }
      if (dead) { finish(waiter, true, aborted()); } else { scheduleCheck(); }
    });
  }
  return { observe, whenSettled, destroy, enter(next) { const previous = source; source = next; return () => { source = previous; }; } };
}
