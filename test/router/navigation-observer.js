import { navigationDriver } from '@mnjs/router';

// Transparent observation only: every Driver operation returns its original
// result, and every native/Router event retains its original scheduling.
export function observeNavigation() {
  const native = navigationDriver();
  const trace = [];
  const matches = new WeakMap();
  const cleanup = [];
  let owner;
  let sequence = 0;
  const matchState = match => {
    if (!match) { return null; }
    if (!matches.has(match)) { matches.set(match, ++sequence); }
    return { id: matches.get(match), key: match.key, name: match.name,
      current: owner?.getCurrent() === match, aborted: match.signal?.aborted };
  };
  const record = (type, match, detail = {}) => {
    trace.push({ type, ...detail, match: matchState(match), current: matchState(owner?.getCurrent()),
      entry: navigation.currentEntry.key, path: location.pathname });
  };
  const subscribe = (target, type, listener) => {
    target.addEventListener(type, listener);
    cleanup.push(() => target.removeEventListener(type, listener));
  };
  subscribe(navigation, 'navigate', event => {
    const detail = { key: event.destination.key, url: event.destination.url, navigationType: event.navigationType,
      sameDocument: event.destination.sameDocument, hashChange: event.hashChange, aborted: event.signal.aborted };
    record('native:navigate', null, detail);
    subscribe(event.signal, 'abort', () => record('native:abort', null, { ...detail, aborted: event.signal.aborted }));
  });
  for (const type of ['currententrychange', 'navigatesuccess', 'navigateerror']) {
    subscribe(navigation, type, event => record(`native:${type}`, null, { error: event.error?.name }));
  }
  const observe = (name, invoke, detail) => {
    record(`driver:${name}:call`, null, detail);
    const result = invoke();
    for (const phase of ['committed', 'finished']) {
      result[phase].then(entry => record(`driver:${name}:${phase}`, null, { ...detail, status: 'fulfilled', key: entry.key }),
        error => record(`driver:${name}:${phase}`, null, { ...detail, status: 'rejected', error: error.name }));
    }
    return result;
  };
  const driver = { ...native,
    get activation() { return native.activation; },
    get currentEntry() { return native.currentEntry; },
    navigate: (url, options) => observe('navigate', () => native.navigate(url, options), { url }),
    back: () => observe('back', () => native.back(), { target: native.entries()[native.currentEntry.index - 1]?.key }),
  };
  return {
    driver, trace, record,
    connect(router) {
      owner = router;
      const route = match => {
        record('router:route', match);
        subscribe(match.signal, 'abort', () => record('router:match-abort', match));
      };
      const ready = match => record('router:ready', match);
      const error = (failure, match) => record('router:error', match, { error: failure.name });
      router.on('route', route); router.on('route:ready', ready); router.on('route:error', error);
      cleanup.push(() => { router.off('route', route); router.off('route:ready', ready); router.off('route:error', error); });
    },
    snapshot(label) { record(label); return { current: matchState(owner.getCurrent()), trace: trace.slice() }; },
    stop() { for (const remove of cleanup.splice(0)) { remove(); } },
  };
}
