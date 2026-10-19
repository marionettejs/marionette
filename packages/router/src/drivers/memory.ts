import type { DriverEntry, DriverEvent, MemoryDriver, DriverNavigateOptions, NavigationResult, NavigationType, SimulateOptions } from '../types.ts';

type Init = Omit<DriverEvent, 'destination' | 'signal' | 'defaultPrevented' | 'preventDefault' | 'intercept'> & {
  url: string; state?: unknown; target?: DriverEntry;
};
type Flags = Omit<SimulateOptions, 'navigationType' | 'state'>;

export function memoryDriver(options: { url?: string } = {}): MemoryDriver {
  const { url = 'http://localhost/' } = options;
  const history = new MemoryHistory(new URL(url).href);

  return {
    capabilities: { cancelTraverse: true, interceptsLinks: true },
    get currentEntry() {
      return history.current;
    },
    documentNavigations: history.documentNavigations,
    entries: () => history.entries.slice(),
    navigate: (target, navigateOptions) => history.navigate(target, navigateOptions),
    reload: reloadOptions => history.reload(reloadOptions),
    back: () => history.back(),
    traverseTo: key => history.traverseTo(key),
    updateCurrentEntry: updateOptions => history.updateCurrentEntry(updateOptions),
    addEventListener: (type, listener, listenerOptions) => history.addEventListener(type, listener, listenerOptions),
    simulate: (target, simulateOptions) => history.simulate(target, simulateOptions),
  };
}

const HISTORY_MODES = ['auto', 'push', 'replace'];
const SIMULATED_TYPES = ['push', 'replace'];

const states = new WeakMap<DriverEntry, unknown>();

const noop = () => {};

const domError = (message: string, name: string) => new DOMException(message, name);

function deferred() {
  const result = Promise.withResolvers<DriverEntry>();
  result.promise.catch(noop);
  return result;
}

function rejected(error: unknown): NavigationResult {
  const committed = Promise.reject(error);
  const finished = Promise.reject(error);
  committed.catch(noop);
  finished.catch(noop);
  return { committed, finished };
}

function resolved(entry: DriverEntry) {
  return { committed: Promise.resolve(entry), finished: Promise.resolve(entry) };
}

function resolveUrl(target: string, base: string) {
  try {
    return new URL(target, base).href;
  } catch {
    throw domError(`Invalid URL: ${ target }`, 'SyntaxError');
  }
}

function sameOrigin(url: string, from: string) {
  return new URL(url).origin === new URL(from).origin;
}

function withoutHash(url: string) {
  const copy = new URL(url);
  copy.hash = '';
  return copy.href;
}

function isHashChange(url: string, from: string) {
  return new URL(url).hash !== '' && url !== from && withoutHash(url) === withoutHash(from);
}

function invoke(handler: () => unknown) {
  try {
    return Promise.resolve(handler());
  } catch (error) {
    return Promise.reject(error);
  }
}

function createEntry(entries: DriverEntry[], { url, key, state }: { url: string; key: string; state: unknown }): DriverEntry {
  const entry: DriverEntry = {
    url,
    key,
    get index() {
      return entries.indexOf(entry);
    },
    getState: () => structuredClone(states.get(entry)),
  };
  states.set(entry, state);
  return entry;
}

function createInit(overrides: Pick<Init, 'navigationType' | 'url'> & Partial<Init>): Init {
  return {
    cancelable: true,
    canIntercept: true,
    hashChange: false,
    userInitiated: false,
    downloadRequest: null,
    formData: null,
    info: undefined,
    ...overrides,
  };
}

function eventFlags(flags: Flags, url: string, from: string) {
  const { canIntercept = sameOrigin(url, from), hashChange = isHashChange(url, from) } = flags;
  const { info, userInitiated = false, downloadRequest = null, formData = null } = flags;
  return { info, userInitiated, downloadRequest, formData, canIntercept, hashChange };
}

class Navigation {
  controller = new AbortController();
  committed = deferred();
  finished = deferred();
  handlers: (() => unknown)[] = [];
  dispatching = false;
  canceled = false;
  intercepted = false;
  settled = false;

  get result() {
    return { committed: this.committed.promise, finished: this.finished.promise };
  }

  succeed(entry: DriverEntry) {
    if (this.settled) {return;}
    this.settled = true;
    this.finished.resolve(entry);
  }

  fail(error: unknown) {
    if (this.settled) {return;}
    this.settled = true;
    this.finished.reject(error);
  }

  abort(error: unknown = domError('Navigation aborted', 'AbortError')) {
    if (this.settled) {return;}
    this.controller.abort(error);
    this.committed.reject(error);
    this.fail(error);
  }

  intercept(handler: (() => unknown) | undefined, canIntercept: boolean) {
    if (!canIntercept) {
      throw domError('This navigation cannot be intercepted', 'SecurityError');
    }
    if (!this.dispatching || this.canceled) {
      throw domError('intercept() is only available while the navigate event is dispatching', 'InvalidStateError');
    }
    this.intercepted = true;
    if (handler) {this.handlers.push(handler);}
  }
}

function createEvent(navigation: Navigation, init: Init, destination: DriverEntry): DriverEvent {
  const { navigationType, canIntercept, hashChange, downloadRequest, formData, userInitiated, info, cancelable } = init;
  return {
    destination,
    navigationType,
    canIntercept,
    hashChange,
    downloadRequest,
    formData,
    userInitiated,
    info,
    cancelable,
    signal: navigation.controller.signal,
    get defaultPrevented() {
      return navigation.canceled;
    },
    preventDefault() {
      if (cancelable && navigation.dispatching) {navigation.canceled = true;}
    },
    intercept({ handler } = {}) {
      navigation.intercept(handler, canIntercept);
    },
  };
}

class MemoryHistory {
  entries: DriverEntry[] = [];
  documentNavigations: string[] = [];
  #position = 0;
  #keys = 0;
  #listeners = new Set<(event: DriverEvent) => void>();
  #active = new Set<Navigation>();

  constructor(url: string) {
    this.entries.push(this.#createEntry(url));
  }

  get current() {
    return this.entries[this.#position];
  }

  navigate(target: string, { history = 'auto', state, info }: DriverNavigateOptions = {}) {
    if (!HISTORY_MODES.includes(history)) {
      throw new TypeError(`Invalid history mode: ${ history }`);
    }
    return this.#navigateTo(target, { history, state, info });
  }

  simulate(target: string, { navigationType = 'push', userInitiated = true, canIntercept = true, ...flags }: SimulateOptions = {}) {
    if (!SIMULATED_TYPES.includes(navigationType)) {
      throw new TypeError(`Cannot simulate navigationType: ${ navigationType }`);
    }
    return this.#navigateTo(target, { history: navigationType, userInitiated, canIntercept, ...flags });
  }

  reload({ info, state }: { info?: unknown; state?: unknown } = {}) {
    let nextState = states.get(this.current);
    try {
      if (state !== undefined) {nextState = structuredClone(state);}
    } catch (error) {
      return rejected(error);
    }
    return this.#start(createInit({ navigationType: 'reload', url: this.current.url, state: nextState, info }));
  }

  back() {
    if (this.#position === 0) {
      return rejected(domError('There is no previous entry', 'InvalidStateError'));
    }
    return this.traverseTo(this.entries[this.#position - 1].key);
  }

  traverseTo(key: string) {
    const target = this.#find(key);
    if (!target) {return rejected(this.#missingEntry(key));}
    if (target === this.current) {return resolved(target);}

    const navigation = new Navigation();
    queueMicrotask(() => this.#traverse(key, navigation));
    return navigation.result;
  }

  updateCurrentEntry({ state }: { state: unknown }) {
    states.set(this.current, structuredClone(state));
  }

  addEventListener(type: 'navigate', listener: (event: DriverEvent) => void, { signal }: { signal?: AbortSignal } = {}) {
    if (type !== 'navigate') {
      throw new TypeError(`Unsupported event type: ${ type }`);
    }
    if (this.#listeners.has(listener) || signal?.aborted) {return;}

    this.#listeners.add(listener);
    signal?.addEventListener('abort', () => this.#listeners.delete(listener), { once: true });
  }

  #createEntry(url: string, state?: unknown, key = `entry-${ ++this.#keys }`) {
    return createEntry(this.entries, { url, key, state });
  }

  #find(key: string) {
    return this.entries.find(entry => entry.key === key);
  }

  #missingEntry(key: string) {
    return domError(`There is no entry with key ${ key }`, 'InvalidStateError');
  }

  #navigateTo(target: string, { history, state, ...flags }: Flags & { history: 'auto' | NavigationType; state?: unknown }) {
    const from = this.current.url;
    let url;
    let clonedState;
    try {
      url = resolveUrl(target, from);
      clonedState = structuredClone(state);
    } catch (error) {
      return rejected(error);
    }

    const navigationType = history === 'auto' ? this.#autoType(url) : history;
    return this.#start(createInit({ navigationType, url, state: clonedState, ...eventFlags(flags, url, from) }));
  }

  #autoType(url: string) {
    return url === this.current.url ? 'replace' : 'push';
  }

  #traverse(key: string, navigation: Navigation) {
    const target = this.#find(key);
    if (!target) {
      navigation.abort(this.#missingEntry(key));
      return;
    }
    if (target === this.current) {
      navigation.committed.resolve(target);
      navigation.succeed(target);
      return;
    }

    const from = this.current.url;
    this.#start(createInit({
      navigationType: 'traverse',
      url: target.url,
      target,
      canIntercept: sameOrigin(target.url, from),
      hashChange: isHashChange(target.url, from),
    }), navigation);
  }

  #start(init: Init, navigation = new Navigation()) {
    this.#supersedeOthers();
    this.#active.add(navigation);
    navigation.dispatching = true;
    this.#dispatch(createEvent(navigation, init, this.#destination(init)));
    navigation.dispatching = false;

    if (navigation.canceled) {navigation.abort();}
    if (navigation.settled) {return navigation.result;}

    const entry = this.#commit(init);
    navigation.committed.resolve(entry);
    this.#finish(navigation, entry);
    return navigation.result;
  }

  #finish(navigation: Navigation, entry: DriverEntry) {
    if (!navigation.intercepted) {
      this.documentNavigations.push(entry.url);
      navigation.succeed(entry);
      return;
    }

    Promise.all(navigation.handlers.map(invoke)).then(
      () => navigation.succeed(entry),
      error => navigation.fail(error),
    );
  }

  #destination({ url, state, target }: Init): DriverEntry {
    if (target) {
      return { url, key: target.key, index: target.index, getState: target.getState };
    }
    return { url, key: '', index: -1, getState: () => structuredClone(state) };
  }

  #supersedeOthers() {
    for (const other of this.#active) {
      other.abort();
      this.#active.delete(other);
    }
  }

  #commit({ navigationType, url, state, target }: Init): DriverEntry {
    if (navigationType === 'traverse') {
      this.#position = this.entries.indexOf(target!);
      return target!;
    }
    if (navigationType === 'push') {
      const entry = this.#createEntry(url, state);
      this.entries.splice(this.#position + 1, Infinity, entry);
      this.#position += 1;
      return entry;
    }

    const entry = this.#createEntry(url, state, this.current.key);
    this.entries[this.#position] = entry;
    return entry;
  }

  #dispatch(event: DriverEvent) {
    for (const listener of [...this.#listeners]) {
      if (!this.#listeners.has(listener)) {continue;}
      try {
        listener(event);
      } catch (error) {
        queueMicrotask(() => {
          throw error;
        });
      }
    }
  }
}
