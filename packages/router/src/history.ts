export interface Entry { readonly href: string; readonly key: string | null; readonly state: unknown }
export interface HistoryDriver {
  read(): Entry;
  write(href: string, options?: { replace?: boolean; state?: unknown }): Entry;
  subscribe(listener: (entry: Entry, kind?: 'traverse' | 'host') => void): () => void;
  go(delta: number): void;
}

const copy = (value: unknown): unknown => value === undefined ? undefined : structuredClone(value);
const snapshot = (entry: Entry): Entry => Object.freeze({ ...entry, state: copy(entry.state) });

export function createMemoryHistory(initial = 'https://care.example/test/worklist/owned-by') {
  let sequence = 0;
  let index = 0;
  const entries: Entry[] = [{ href: new URL(initial).href, key: `e${sequence++}`, state: undefined }];
  const listeners = new Set<(entry: Entry) => void>();
  return {
    read: () => snapshot(entries[index]),
    write(href: string, { replace = false, state }: { replace?: boolean; state?: unknown } = {}) {
      const entry = { href, state: copy(state), key: replace ? entries[index].key : `e${sequence++}` };
      if (replace) {entries[index] = entry;} else { entries.splice(index + 1); entries.push(entry); index++; }
      return snapshot(entry);
    },
    subscribe(listener: (entry: Entry) => void) { listeners.add(listener); return () => listeners.delete(listener); },
    go(delta: number) {
      const next = index + delta;
      if (next < 0 || next >= entries.length || next === index) {return;}
      index = next;
      for (const listener of listeners) {listener(snapshot(entries[index]));}
    },
    // Public test-driver observations, not production router internals.
    inspect: () => ({ index, entries: entries.map(snapshot), subscriptions: listeners.size }),
  };
}

// This adapter exclusively owns same-document history writes while mounted.
// Initial host state must be null or a plain object (the app's auth code uses {}).
// Isolated Chromium/Firefox/WebKit fixtures cover this contract; full product
// history, auth, BFCache, and supported-browser conformance remain release gates.
export function createBrowserHistory(window: Window, namespace = '__routerPrototype') {
  let sequence = 0;
  const prefix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const newKey = () => `${prefix}-${sequence++}`;
  const hostState = () => {
    const state = window.history.state;
    if (state != null && (typeof state !== 'object' || Array.isArray(state) ||
      Object.getPrototypeOf(state) !== Object.prototype)) {
      throw new TypeError('Browser adapter requires a plain-object history state');
    }
    return state ?? {};
  };
  const read = () => {
    const data = window.history.state?.[namespace] as { key?: string; state?: unknown } | undefined;
    return snapshot({ href: window.location.href, key: data?.key ?? null, state: data?.state });
  };
  // Do not rewrite/adopt foreign traversal entries merely to manufacture a key.
  const initial = hostState();
  if (!initial[namespace]) {window.history.replaceState({ ...initial, [namespace]: { key: newKey() } }, '', window.location.href);}
  return {
    read,
    write(href: string, { replace = false, state }: { replace?: boolean; state?: unknown } = {}) {
      const current = hostState();
      const key = replace ? current[namespace]?.key ?? newKey() : newKey();
      const next = { ...current, [namespace]: { key, state: copy(state) } };
      window.history[replace ? 'replaceState' : 'pushState'](next, '', href);
      return read();
    },
    subscribe(listener: (entry: Entry) => void) {
      const onPop = () => listener(read());
      window.addEventListener('popstate', onPop);
      return () => window.removeEventListener('popstate', onPop);
    },
    go: (delta: number) => window.history.go(delta),
  };
}
