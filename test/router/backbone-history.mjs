// Isolated coexistence experiment, not a production adapter.
// Backbone remains the only native URL listener/writer. This layer observes its
// public loadUrl AND programmatic navigate calls, including silent
// EventRouter writes. Install after existing wrappers; remove in reverse order.
export function createBackboneHistory(Backbone, window) {
  const history = Backbone.history;
  const originalNavigate = history.navigate;
  const originalLoadUrl = history.loadUrl;
  const listeners = new Set();
  let callDepth = 0;
  let ownWrites = 0;
  let ownWriteGeneration = 0;
  const read = () => Object.freeze({ href: window.location.href, key: null, state: undefined });
  const publish = () => {
    if (callDepth || ownWrites) {return;}
    // Backbone dispatch also arises from loadUrl replay. Do not mislabel all
    // host observations as browser Back/Forward; preserve the host boundary.
    for (const listener of listeners) {listener(read(), 'host');}
  };
  function wrap(original) {
    return function(...args) {
      const before = ownWriteGeneration;
      callDepth++;
      try { return original.apply(this, args); } finally {
        callDepth--;
        // Cover direct replay and traversal, not only an outer navigate call.
        // A nested core navigation already published its newer destination.
        if (before === ownWriteGeneration) {publish();}
      }
    };
  }
  const navigate = wrap(originalNavigate);
  const loadUrl = wrap(originalLoadUrl);
  history.navigate = navigate;
  history.loadUrl = loadUrl;
  return {
    read,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    write(href, { replace = false, state } = {}) {
      if (state !== undefined) {throw new TypeError('Backbone bridge does not support entry state');}
      const url = new URL(href);
      if (url.hash) {throw new TypeError('Backbone bridge does not support hash targets');}
      ownWriteGeneration++;
      ownWrites++;
      try {
        const result = history.navigate(url.pathname + url.search, { trigger: false, replace });
        if (result === false) {throw new Error('Backbone history is not started');}
      } finally { ownWrites--; }
      return read();
    },
    go: delta => window.history.go(delta),
    dispose() {
      if (history.navigate !== navigate || history.loadUrl !== loadUrl) {throw new Error('Remove newer history wrappers before this bridge');}
      history.navigate = originalNavigate;
      history.loadUrl = originalLoadUrl;
      listeners.clear();
    },
  };
}
