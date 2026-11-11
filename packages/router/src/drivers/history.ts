import type { Driver, DriverEntry, DriverEvent, DriverNavigateOptions, NavigationResult, NavigationType } from '../types.ts';

const META = '@mnjs/router/history';
const noop = () => {};
const error = (message: string, name: string) => new DOMException(message, name);
const isObject = (value: unknown): value is Record<string, unknown> => Object.prototype.toString.call(value) === '[object Object]';
type Stamp = { version: 1; scope: string; key: string; boxed: boolean; value?: unknown };

function unpack(raw: unknown): { state: unknown; stamp?: Stamp } {
  const stamp = isObject(raw) ? raw[META] : undefined;
  if (isObject(stamp) && stamp.version === 1 && typeof stamp.scope === 'string' &&
      typeof stamp.key === 'string' && typeof stamp.boxed === 'boolean') {
    const state = structuredClone(raw) as Record<string, unknown>;
    const metadata = state[META] as Stamp;
    delete state[META];
    return { state: metadata.boxed ? metadata.value : state, stamp: stamp as Stamp };
  }
  return { state: structuredClone(raw) };
}

function pack(state: unknown, scope: string, key: string) {
  if (isObject(state) && Object.hasOwn(state, META)) {throw new TypeError(`History state reserves "${ META }"`);}
  const boxed = !isObject(state);
  const clone = structuredClone(state);
  const stored = boxed ? {} : clone as Record<string, unknown>;
  stored[META] = { version: 1, scope, key, boxed, ...(boxed ? { value: clone } : {}) };
  return stored;
}

function hashChange(url: string, from: string) {
  if (!url.includes('#') || url === from) {return false;}
  const target = new URL(url); const previous = new URL(from);
  target.hash = ''; previous.hash = '';
  return target.href === previous.href;
}

function resolveUrl(target: string, from: string) {
  try {return new URL(target, from);} catch {throw error(`Invalid URL: ${ target }`, 'SyntaxError');}
}

class Transition {
  controller = new AbortController();
  committed = Promise.withResolvers<DriverEntry>();
  finished = Promise.withResolvers<DriverEntry>();
  handlers: (() => unknown)[] = [];
  dispatching = true;
  intercepted = false;
  canceled = false;

  constructor() {
    this.committed.promise.catch(noop); this.finished.promise.catch(noop);
  }
  get result(): NavigationResult {return { committed: this.committed.promise, finished: this.finished.promise };}
  abort(reason: unknown = error('Navigation aborted', 'AbortError')) {
    this.controller.abort(reason);
    this.committed.reject(reason); this.finished.reject(reason);
  }
  finish(entry: DriverEntry) {
    Promise.all(this.handlers.map(async handler => handler())).then(
      () => this.finished.resolve(entry),
      reason => {this.finished.reject(reason); this.controller.abort(reason);},
    );
  }
}

/* History-based same-document routing. It does not enumerate unknown history. */
export function historyDriver({ window: source = globalThis.window }: { window?: Window } = {}): Driver {
  if (!source) {throw new TypeError('historyDriver requires a browser Window');}
  return new HistoryDriver(source).driver;
}

class HistoryDriver {
  #source: Window;
  #scope = `${ Date.now().toString(36) }-${ Math.random().toString(36).slice(2) }`;
  #sequence = 0;
  #entries: DriverEntry[] = [];
  #current!: DriverEntry;
  #url: string;
  #states = new WeakMap<DriverEntry, unknown>();
  #listeners = new Map<(event: DriverEvent) => void, () => void>();
  #active: Transition | null = null;
  #traversals = new Map<string, Transition>();
  #traversing: string | null = null;

  constructor(source: Window) {
    this.#source = source;
    this.#url = source.location.href;
    this.#reset(unpack(source.history.state).state);
  }

  get driver(): Driver {
    const history = this;
    return {
      capabilities: { cancelTraverse: false, interceptsLinks: true },
      get currentEntry() {history.#sync(); return history.#current;},
      entries: () => {history.#sync(); return history.#entries.slice();},
      navigate: (url, options) => this.#navigate(url, options),
      reload: (options = {}) => this.#navigate(this.#source.location.href, { ...options, history: 'replace' }, 'reload'),
      back: () => {this.#sync(); return this.#traverse(this.#entries[this.#current.index - 1]?.key);},
      traverseTo: key => {this.#sync(); return this.#traverse(key);},
      updateCurrentEntry: options => this.#update(options.state),
      addEventListener: (type, listener, options) => this.#subscribe(type, listener, options?.signal),
    };
  }

  #entry(url: string, state: unknown, key = `${ this.#scope }:${ ++this.#sequence }`): DriverEntry {
    const history = this;
    const entry: DriverEntry = { url, key,
      get index() {return history.#entries.indexOf(entry);},
      getState: () => {
        const { state: current, stamp } = unpack(this.#source.history.state);
        return stamp?.scope === this.#scope && stamp.key === key && this.#source.location.href === url ? current : structuredClone(this.#states.get(entry));
      },
    };
    this.#states.set(entry, state);
    return entry;
  }

  #reset(state: unknown) {
    const entry = this.#entry(this.#source.location.href, state);
    const stored = pack(state, this.#scope, entry.key);
    const previous = this.#entries; const old = this.#current;
    this.#entries = [entry]; this.#current = entry;
    try {this.#source.history.replaceState(stored, '');} catch (reason) {
      this.#entries = previous; this.#current = old; throw reason;
    }
    this.#cancelTraversals();
    return this.#current;
  }

  #sync() {
    const { state, stamp } = unpack(this.#source.history.state);
    const entry = stamp?.scope === this.#scope && this.#entries.find(item => item.key === stamp.key && item.url === this.#source.location.href);
    if (entry) {this.#states.set(entry, state); this.#current = entry; return entry;}
    return this.#reset(state);
  }

  #update(state: unknown) {
    this.#sync();
    const entry = this.#current;
    const snapshot = structuredClone(state);
    const stored = pack(snapshot, this.#scope, entry.key);
    this.#source.history.replaceState(stored, '');
    if (this.#current === entry) {this.#states.set(entry, entry.getState());}
  }

  #subscribe(type: 'navigate', listener: (event: DriverEvent) => void, signal?: AbortSignal) {
    if (type !== 'navigate') {throw new TypeError(`Unsupported event type: ${ type }`);}
    if (signal?.aborted || this.#listeners.has(listener)) {return;}
    const remove = () => {
      this.#listeners.delete(listener); signal?.removeEventListener('abort', remove);
      if (!this.#listeners.size) {this.#detach();}
    };
    this.#listeners.set(listener, remove);
    signal?.addEventListener('abort', remove, { once: true });
    if (this.#listeners.size === 1) {
      try {
        const entry = this.#sync();
        if (entry.key === this.#traversing) {this.#traversing = null;}
        this.#url = entry.url;
      } catch (reason) {
        this.#listeners.delete(listener); signal?.removeEventListener('abort', remove); throw reason;
      }
      if (!this.#listeners.size) {return;}
      this.#source.addEventListener('popstate', this.#pop);
      this.#source.addEventListener('hashchange', this.#hash);
      this.#source.addEventListener('pagehide', this.#leave);
      this.#source.document.addEventListener('click', this.#click);
    }
  }

  #detach() {
    this.#source.removeEventListener('popstate', this.#pop);
    this.#source.removeEventListener('hashchange', this.#hash);
    this.#source.removeEventListener('pagehide', this.#leave);
    this.#source.document.removeEventListener('click', this.#click);
    this.#leave();
  }

  #leave = () => {
    const previous = this.#active;
    this.#active = null;
    this.#cancelTraversals();
    previous?.abort();
  };

  #cancelTraversals(keep?: Transition) {
    const previous = [...this.#traversals.values()];
    this.#traversals.clear();
    for (const pending of previous) {if (pending !== keep) {pending.abort();}}
  }

  #activate(nav: Transition) {
    const previous = this.#active;
    this.#active = nav;
    this.#cancelTraversals(nav);
    previous?.abort();
    return this.#active === nav && !nav.controller.signal.aborted;
  }

  #dispatch(nav: Transition, entry: DriverEntry, type: NavigationType, from: string, cancelable: boolean, info: unknown, userInitiated: boolean) {
    const canIntercept = new URL(entry.url).origin === this.#source.location.origin && /^https?:/.test(entry.url);
    const event: DriverEvent = {
      destination: entry, navigationType: type, canIntercept, hashChange: hashChange(entry.url, from),
      formData: null, downloadRequest: null, info, userInitiated, cancelable, signal: nav.controller.signal,
      get defaultPrevented() {return nav.canceled;},
      preventDefault() {if (cancelable && nav.dispatching) {nav.canceled = true;}},
      intercept({ handler } = {}) {
        if (!canIntercept) {throw error('This navigation cannot be intercepted', 'SecurityError');}
        if (!nav.dispatching || nav.canceled || nav.controller.signal.aborted) {throw error('Navigation is no longer dispatching', 'InvalidStateError');}
        nav.intercepted = true;
        if (handler) {nav.handlers.push(handler);}
      },
    };
    for (const listener of [...this.#listeners.keys()]) {
      if (!this.#listeners.has(listener)) {continue;}
      try {listener(event);} catch (reason) {queueMicrotask(() => {throw reason;});}
    }
    nav.dispatching = false;
    if (nav.canceled) {nav.abort();}
    return this.#active === nav && !nav.controller.signal.aborted;
  }

  #navigate(target: string, options: DriverNavigateOptions = {}, type?: 'reload', click?: MouseEvent) {
    const nav = new Transition();
    try {
      this.#sync();
      const from = this.#current.url;
      const parsed = resolveUrl(target, from);
      // Navigation.navigate rejects script URLs; Location.assign would run them.
      // eslint-disable-next-line no-script-url -- Reject this protocol instead of executing it.
      if (parsed.protocol === 'javascript:') {throw error('Script URL navigation is not supported', 'NotSupportedError');}
      const url = parsed.href;
      const mode = options.history ?? 'auto';
      if (!['auto', 'push', 'replace'].includes(mode)) {throw new TypeError(`Unknown history mode: ${ mode }`);}
      const hasState = Object.hasOwn(options, 'state');
      const snapshot = structuredClone(type === 'reload' && !hasState ? this.#current.getState() : options.state);
      const replacing = mode === 'replace' || (mode === 'auto' && url === from);
      const entry = this.#entry(url, snapshot, replacing ? this.#current.key : undefined);
      const stored = pack(snapshot, this.#scope, entry.key);
      if (!this.#activate(nav) || !this.#dispatch(nav, entry, type ?? (replacing ? 'replace' : 'push'), from, true, options.info, click?.isTrusted ?? false)) {
        click?.preventDefault(); nav.abort(); return nav.result;
      }
      if (!nav.intercepted) {
        if (type === 'reload' && hasState) {this.#update(snapshot);}
        nav.abort();
        if (this.#active !== nav) {click?.preventDefault(); return nav.result;}
        if (!click) {
          if (type === 'reload') {this.#source.location.reload();} else if (replacing) {this.#source.location.replace(url);} else {this.#source.location.assign(url);}
        }
        return nav.result;
      }
      click?.preventDefault();
      const previous = this.#entries;
      const old = this.#current;
      this.#entries = [...previous.slice(0, old.index + (replacing ? 0 : 1)), entry, ...(replacing ? previous.slice(old.index + 1) : [])];
      this.#current = entry;
      try {
        if (replacing) {this.#source.history.replaceState(stored, '', url);} else {this.#source.history.pushState(stored, '', url);}
      } catch (reason) {
        this.#entries = previous; this.#current = old; throw reason;
      }
      if (this.#active === nav && !nav.controller.signal.aborted) {
        this.#url = entry.url; nav.committed.resolve(entry); nav.finish(entry);
      } else {nav.abort();}
    } catch (reason) {nav.abort(reason);}
    return nav.result;
  }

  #traverse(key: string | undefined): NavigationResult {
    const entry = this.#entries.find(item => item.key === key);
    if (!entry) {
      const nav = new Transition(); nav.abort(error(`Unknown history entry "${ key }"`, 'InvalidStateError')); return nav.result;
    }
    if (entry === this.#current) {return { committed: Promise.resolve(entry), finished: Promise.resolve(entry) };}
    const existing = this.#traversals.get(entry.key);
    if (existing) {return existing.result;}
    const nav = new Transition();
    // go() uses a relative delta when the browser processes it. A second queued
    // delta can reach a different key; do not promise an absolute destination.
    if (this.#traversing !== null) {
      nav.abort(error('A History traversal is already outstanding', 'InvalidStateError')); return nav.result;
    }
    this.#traversing = entry.key;
    this.#traversals.set(entry.key, nav);
    try {this.#source.history.go(entry.index - this.#current.index);} catch (reason) {
      this.#traversing = null; this.#traversals.delete(entry.key); nav.abort(reason);
    }
    return nav.result;
  }

  #pop = () => {
    // Public entry reads can resynchronize the cache before this event arrives.
    const from = this.#url;
    const entry = this.#sync();
    this.#url = entry.url;
    if (entry.key === this.#traversing) {this.#traversing = null;}
    const nav = this.#traversals.get(entry.key) ?? new Transition();
    nav.committed.resolve(entry);
    if (!this.#activate(nav)) {nav.abort(); return;}
    // popstate cannot distinguish user traversal from history.go() by other code.
    if (this.#dispatch(nav, entry, 'traverse', from, false, undefined, false)) {nav.finish(entry);} else {nav.abort();}
  };

  #hash = () => {
    if (this.#source.location.href !== this.#current.url) {this.#pop();}
  };

  #click = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {return;}
    const anchor = event.composedPath().find(node => (node as Element).localName === 'a') as HTMLAnchorElement | undefined;
    if (!anchor || !anchor.hasAttribute('href') || anchor.hasAttribute('download')) {return;}
    const target = anchor.getAttribute('target') ?? this.#source.document.querySelector('base[target]')?.getAttribute('target') ?? '';
    if (target && target.toLowerCase() !== '_self') {return;}
    const href = anchor.getAttribute('href')!;
    if (!URL.canParse(href, this.#source.document.baseURI)) {return;}
    const url = new URL(href, this.#source.document.baseURI);
    if (url.origin !== this.#source.location.origin || !/^https?:/.test(url.protocol) || hashChange(url.href, this.#source.location.href)) {return;}
    this.#navigate(url.href, { history: 'push' }, undefined, event);
  };
}
