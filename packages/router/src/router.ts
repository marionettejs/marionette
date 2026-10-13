import type { Definitions, RouteTable, NamedTarget, Match } from './routes.js';
import type { Entry, HistoryDriver } from './history.js';
export type Kind = 'initial' | 'push' | 'replace' | 'repeat' | 'traverse' | 'host' | 'refresh' | 'reflect';
export interface Context<D extends Definitions> {
  readonly id: number;
  readonly kind: Kind;
  readonly location: Entry;
  readonly match: Match<D> | null;
  readonly info: unknown;
  readonly signal: AbortSignal;
  isCurrent(): boolean;
  /** Permission to invoke one synchronous effect; not a transaction or rollback. */
  runIfCurrent(effect: () => undefined): boolean;
}
export type Outcome<D extends Definitions> =
  | { status: 'handled' | 'reflected'; context: Context<D> }
  | { status: 'failed'; error: unknown; context: Context<D> }
  | { status: 'superseded' | 'unchanged' | 'disposed' };
export interface NavigationOptions { history?: 'push' | 'replace'; state?: unknown; info?: unknown }
export interface RouterOptions<D extends Definitions> {
  routes: RouteTable<D>;
  history: HistoryDriver;
  dispatch(context: Context<D>): unknown;
  onError?(error: unknown, context: Context<D>): unknown;
  signal?: AbortSignal;
}
export interface Router<D extends Definitions> {
  readonly location: Entry;
  readonly lastDispatch: Context<D> | undefined;
  href(target: NamedTarget<D>): string;
  resolve(target: NamedTarget<D> | string | URL): { href: string; match: Match<D> | null };
  navigate(target: NamedTarget<D> | string | URL, options?: NavigationOptions): Promise<Outcome<D>>;
  reflect(target: NamedTarget<D> | string | URL, options?: NavigationOptions): Promise<Outcome<D>>;
  refresh(options?: { info?: unknown }): Promise<Outcome<D>>;
  start(): Promise<Outcome<D>>;
  go(delta: number): void;
  dispose(): void;
}
// A URL dispatcher, not an Application lifecycle, loader cache, or render engine.
export function createRouter<D extends Definitions>({ routes, history, dispatch, onError = console.error, signal }: RouterOptions<D>): Router<D> {
  let disposed = false;
  let started = false;
  let unsubscribe: (() => void) | undefined;
  let active: { controller: AbortController; finish: (outcome: Outcome<D>) => void } | undefined;
  let lastDispatch: Context<D> | undefined;
  let location = history.read();
  let sequence = 0;
  const origin = new URL(location.href).origin;

  function resolve(target: NamedTarget<D> | string | URL) {
    const href = typeof target === 'string' || target instanceof URL ? String(target) : routes.href(target);
    const url = new URL(href, location.href);
    if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new TypeError('Router destinations must be same-origin HTTP(S) URLs');
    }
    return { href: url.href, match: routes.match(url) };
  }

  function transition(entry: Entry, match: Match<D> | null, kind: Kind, info?: unknown, reflected = false): Promise<Outcome<D>> {
    let finish!: (outcome: Outcome<D>) => void;
    const finished = new Promise<Outcome<D>>(complete => { finish = complete; });
    const controller = new AbortController();
    const previous = active;
    const intent = { controller, finish };
    // Publish identity before synchronous abort listeners can navigate again.
    active = intent;
    location = entry;
    const context: Context<D> = Object.freeze({
      id: ++sequence, kind, location: entry, match, info, signal: controller.signal,
      isCurrent: () => !disposed && active === intent,
      // Use after awaits and before publishing domain results or redirects.
      runIfCurrent(effect: () => undefined) {
        if (disposed || active !== intent) {return false;}
        effect();
        return true;
      },
    });
    previous?.finish({ status: 'superseded' });
    previous?.controller.abort();
    if (disposed || active !== intent) {
      finish({ status: 'superseded' });
      return finished;
    }
    if (reflected) {
      finish({ status: 'reflected', context });
      return finished;
    }
    lastDispatch = context;
    let work;
    try { work = dispatch(context); } catch (error) { work = Promise.reject(error); }
    // Always observe obsolete work. Cancellation is prompt even if it never settles.
    Promise.resolve(work).then(
      () => finish(context.isCurrent() ? { status: 'handled', context } : { status: 'superseded' }),
      error => {
        if (!context.isCurrent()) {return;}
        finish({ status: 'failed', error, context });
        return onError(error, context);
      },
    ).catch(error => console.error('Router error reporter failed', error));
    return finished;
  }

  function write(target: NamedTarget<D> | string | URL, options: NavigationOptions = {}, reflected = false): Promise<Outcome<D>> {
    if (disposed) {return Promise.resolve({ status: 'disposed' });}
    const destination = resolve(target);
    const beforeWrite = sequence;
    if (!reflected && destination.href === location.href) {
      // Repeated selections can carry transient intent at an unchanged URL.
      // No duplicate browser entry; refresh remains a distinct domain operation.
      const entry = options.state === undefined ? location :
        history.write(destination.href, { replace: true, state: options.state });
      if (disposed || sequence !== beforeWrite) {return Promise.resolve({ status: 'superseded' });}
      return transition(entry, destination.match, 'repeat', options.info);
    }
    // Eager URL semantics. Write errors occur before invalidation or dispatch.
    const replace = options.history === 'replace';
    const state = replace && options.state === undefined ? location.state : options.state;
    const entry = history.write(destination.href, { replace, state });
    // A borrowed transport can synchronously notify application code while it
    // writes. A nested accepted intent owns dispatch; never pair its URL with
    // this older match. The transport's writes are not rolled back.
    if (disposed || sequence !== beforeWrite) {return Promise.resolve({ status: 'superseded' });}
    return transition(entry, destination.match, reflected ? 'reflect' : options.history === 'replace' ? 'replace' : 'push', options.info, reflected);
  }

  function dispose() {
    if (disposed) {return;}
    disposed = true;
    unsubscribe?.();
    signal?.removeEventListener('abort', dispose);
    active?.finish({ status: 'superseded' });
    active?.controller.abort();
    active = undefined;
  }

  function observe(entry: Entry, kind: Kind, info?: unknown) {
    let match;
    try { match = routes.match(entry.href); } catch (error) { return transition(entry, null, kind, { ...(info as object), malformedURL: error }); }
    return transition(entry, match, kind, info);
  }

  const router: Router<D> = {
    href: routes.href,
    resolve,
    get location() { return location; },
    get lastDispatch() { return lastDispatch; },
    start() {
      if (disposed) {return Promise.resolve({ status: 'disposed' });}
      if (started) {return Promise.resolve({ status: 'unchanged' });}
      started = true;
      unsubscribe = history.subscribe((entry, kind = 'traverse') => { observe(entry, kind); });
      location = history.read();
      return observe(location, 'initial');
    },
    navigate: (target, options) => write(target, options),
    // Reflect state already applied by the owning feature; no dispatch/reload.
    reflect: (target, options = {}) => write(target, { ...options, history: options.history ?? 'replace' }, true),
    refresh({ info } = {}) {
      if (disposed) {return Promise.resolve({ status: 'disposed' });}
      return observe(location, 'refresh', info);
    },
    go: delta => { if (!disposed) {history.go(delta);} },
    dispose,
  };
  if (signal?.aborted) {dispose();} else {signal?.addEventListener('abort', dispose, { once: true });}
  return router;
}
