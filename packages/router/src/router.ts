type InterceptionPolicy = Readonly<Pick<NavigateOptions, 'focusReset' | 'scroll'>>;
type Chain = { initial: boolean; hops: number; followUp: NavigationResult<boolean> | null; policy: InterceptionPolicy };
type Session = { controller: AbortController; initial: Promise<boolean> };
type Navigation = {
  url: URL; chain: Chain; controller: AbortController; signal: AbortSignal;
  navigationType: DriverEvent['navigationType']; initial: boolean; info: unknown; userInitiated: boolean;
  key: string; rawState: unknown; match: ActiveMatch | null;
};
type Base = Pick<MatcherResult, 'name' | 'params' | 'url' | 'query' | 'meta' | 'branch'>;
type Plan = { hop: string; base?: never; pending?: never } |
  { hop?: never; base: Base; pending: PromiseLike<RedirectTarget | null | undefined> | null };

import { MnObject } from 'marionette';
import type { MnObjectInstance, MnObjectConstructor } from 'marionette';
import type { ActiveMatch, Match, Params, Query, EntryState, RouterOptions, NavigateOptions, Driver, DriverEntry, DriverEvent, NavigationResult, NavigationOptions, DriverNavigateOptions, RouteDefinition, MatcherResult, RedirectTarget } from './types.ts';

import { Matcher } from './matcher.ts';
import { toSearchParams } from './query.ts';
import { navigationDriver } from './drivers/navigation.ts';

const MARKER = '@mnjs/router';
const URL_FORM = /^(?:\/|[a-z][a-z\d+.-]*:\/\/)/i;
const noop = () => {};

const isObject = (value: unknown): value is EntryState => typeof value === 'object' && value !== null &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

const isThenable = (value: unknown): value is PromiseLike<RedirectTarget | null | undefined> =>
  typeof (value as PromiseLike<unknown> | null)?.then === 'function';

const isMarked = (state: unknown) => isObject(state) && state[MARKER] === true;

function newChain(initial = false, { focusReset, scroll }: InterceptionPolicy = {}): Chain {
  return { initial, hops: 0, followUp: null, policy: {
    ...(focusReset === undefined ? {} : { focusReset }),
    ...(scroll === undefined ? {} : { scroll }),
  } };
}

function rejection(error: unknown): Promise<never> {
  const promise = Promise.reject(error);
  promise.catch(noop);
  return promise;
}

function assertState(state: unknown): asserts state is EntryState | null | undefined {
  if (state !== undefined && state !== null && !isObject(state)) {
    throw new TypeError('Entry state must be a plain object');
  }
}

function withMarker(state: unknown) {
  assertState(state);
  return { ...state, [MARKER]: true };
}

function publicState(state: unknown) {
  if (!isObject(state)) {return state ?? undefined;}
  const copy = { ...state };
  delete copy[MARKER];
  return copy;
}

function outcome(promise: Promise<unknown>) {
  return promise.then(() => true, error => {
    if (error?.name === 'AbortError') {return false;}
    throw error;
  });
}

function notFoundBase(name: string, params: Record<string, string>, url: URL): Base {
  return { name, params, query: new URLSearchParams(url.search), url, meta: {}, branch: [] };
}

function toMatch(base: Base, nav: Pick<Match, 'navigationType' | 'initial' | 'info' | 'signal' | 'userInitiated'>, key: string, rawState: unknown): Match {
  return {
    name: base.name,
    params: base.params,
    query: base.query,
    url: base.url,
    meta: base.meta,
    branch: base.branch,
    navigationType: nav.navigationType,
    initial: nav.initial,
    info: nav.info,
    state: publicState(rawState),
    key,
    signal: nav.signal,
    userInitiated: nav.userInitiated,
  };
}

export interface RouterMethods extends RouterOptions {
  start(): Promise<boolean>;
  stop(): boolean;
  navigate(nameOrUrl: string, params?: Params | NavigateOptions, options?: NavigateOptions): NavigationResult<boolean>;
  url(name: string, params?: Params, options?: { query?: Query }): string;
  match(url: URL | string): Match | null;
  getCurrent(): ActiveMatch | null;
  refresh(): Promise<boolean>;
  mount(routes: RouteDefinition[], options?: { parent?: string }): () => void;
  getParamNames(name: string): string[];
  hasRoute(name: string): boolean;
  readonly canGoBack: boolean;
  back(): Promise<boolean>;
  updateState(state: EntryState): boolean;
}
export type RouterInstance = MnObjectInstance<RouterOptions> & RouterMethods;
export type RouterConstructor = MnObjectConstructor<RouterMethods, [options?: RouterOptions]>;

type RouterState = {
  matcher: Matcher | null;
  resolvedDriver: Driver | null;
  session: Session | null;
  local: AbortController | null;
  chain: Chain | null;
  current: ActiveMatch | null;
  currentController: AbortController | null;
  traversals: Set<{ key: string; chain: Chain }>;
  closed: boolean;
};
const states = new WeakMap<RouterInstance, RouterState>();
const stateFor = (router: RouterInstance) => states.get(router)!;
function option<Key extends keyof RouterOptions>(router: RouterInstance, key: Key): RouterOptions[Key] {
  return router.getOption(key) as RouterOptions[Key];
}
function getMatcher(router: RouterInstance) {
  const internals = stateFor(router);
  if (!internals.matcher) {
    const routes = option(router, 'routes')!;
    internals.matcher = new Matcher(typeof routes === 'function' ? routes.call(router) : routes);
  }
  return internals.matcher;
}
function canceledNavigation(): NavigationResult<boolean> {
  const canceled = Promise.resolve(false);
  return { committed: canceled, finished: canceled };
}
function stopRouting(router: RouterInstance) {
  const internals = stateFor(router);
  const { local, currentController, session } = internals;
  internals.local = null;
  internals.currentController = null;
  internals.session = null;
  internals.traversals.clear();
  local?.abort();
  currentController?.abort();
  session?.controller.abort();
}
function constructRouter(this: RouterInstance, options?: RouterOptions) {
  states.set(this, {
    matcher: null, resolvedDriver: null, session: null, local: null, chain: null,
    current: null, currentController: null, traversals: new Set(), closed: false
  });
  // Internal state exists before initialize. Normal MnObject construction merges
  // options first; a subclass can safely use matching or start from initialize.
  MnObject.call(this, options);
  getMatcher(this);
}

function getDriver(router: RouterInstance): Driver {
  const internals = stateFor(router);
  internals.resolvedDriver ??= option(router, 'driver') ?? navigationDriver();
  return internals.resolvedDriver;
}

// Omitted state survives a same-path replacement; other navigations start empty.
function entryState(router: RouterInstance, href: string, history: NavigationOptions['history'], state: unknown) {
  if (state !== undefined) {return withMarker(state);}

  const entry = getDriver(router).currentEntry;
  const current = new URL(entry.url);
  const target = new URL(href, current);
  const replaces = history === 'replace' || (history === 'auto' && target.href === current.href);
  const existing = replaces && target.pathname === current.pathname ? entry.getState() : undefined;

  return withMarker(isObject(existing) ? existing : undefined);
}

function withPersisted(router: RouterInstance, name: string, params: Params) {
  const internals = stateFor(router);
  const current = internals.current;
  if (!current || !option(router, 'persistParams')!.length) {return params;}
  const names = getMatcher(router).getParamNames(name);
  const persisted = option(router, 'persistParams')!
    .filter(key => names.includes(key) && !Object.hasOwn(params, key) && Object.hasOwn(current.params, key))
    .map(key => [key, current.params[key]]);
  return { ...Object.fromEntries(persisted), ...params };
}

function urlTarget(router: RouterInstance, url: string, { query }: NavigateOptions) {
  const target = new URL(url, getDriver(router).currentEntry.url);
  if (query !== undefined) {target.search = toSearchParams(query).toString();}
  return target.href;
}

function navigateDriver(router: RouterInstance, href: string, options: DriverNavigateOptions, chain: Chain): NavigationResult<boolean> {
  const internals = stateFor(router);
  internals.chain = chain;
  try {
    return settle(getDriver(router).navigate(href, options), chain);
  } finally {
    internals.chain = null;
  }
}

// A navigation superseded by its own redirect follows the redirect's outcome.
function settle(result: NavigationResult, chain: Chain): NavigationResult<boolean> {
  const follow = (ok: boolean, key: 'committed' | 'finished') => (ok || !chain.followUp ? ok : chain.followUp[key]);
  const committed = outcome(result.committed).then(ok => follow(ok, 'committed'));
  const finished = outcome(result.finished).then(ok => follow(ok, 'finished'));
  committed.catch(noop);
  finished.catch(noop);
  return { committed, finished };
}

function takeChain(router: RouterInstance, event: DriverEvent) {
  const internals = stateFor(router);
  if (event.navigationType === 'traverse') {
    const request = [...internals.traversals].find(item => item.key === event.destination.key);
    if (request) {
      internals.traversals.delete(request);
      return request.chain;
    }
  }
  const chain = internals.chain ?? newChain();
  internals.chain = null;
  return chain;
}

function abortLocal(router: RouterInstance) {
  const internals = stateFor(router);
  internals.local?.abort();
  internals.local = null;
}

function intercepts(router: RouterInstance, event: DriverEvent, url: URL) {
  if (event.defaultPrevented || event.signal.aborted || !event.canIntercept || event.hashChange || event.navigationType === 'reload') {return false;}
  if (event.downloadRequest !== null || event.formData !== null) {return false;}
  return url.origin === new URL(getDriver(router).currentEntry.url).origin;
}

function claims(router: RouterInstance, url: URL) {
  if (!option(router, 'intercept')!.call(router, url)) {return false;}
  return Boolean(getMatcher(router).match(url) ?? option(router, 'notFound')?.within(url));
}

function onNavigate(router: RouterInstance, event: DriverEvent) {
  const chain = takeChain(router, event);
  const url = new URL(event.destination.url);
  if (!intercepts(router, event, url)) {return;}
  const nav = navigationFor(router, event, url, chain);
  const plan = planNavigation(router, nav);
  if (!plan) {return;}
  abortLocal(router);
  event.intercept({ handler: () => execute(router, plan, nav), ...chain.policy });
}

function navigationFor(router: RouterInstance, event: DriverEvent, url: URL, chain: Chain): Navigation {
  const internals = stateFor(router);
  const controller = new AbortController();
  return {
    url,
    chain,
    controller,
    signal: AbortSignal.any([event.signal, internals.session!.controller.signal, controller.signal]),
    navigationType: event.navigationType,
    initial: chain.initial,
    info: event.info,
    userInitiated: event.userInitiated,
    key: event.destination.key,
    rawState: event.destination.getState(),
    match: null,
  };
}

async function dispatchInitial(router: RouterInstance, session: Session): Promise<boolean> {
  const internals = stateFor(router);
  const driver = getDriver(router);
  const entry = driver.currentEntry;
  const local = new AbortController();
  const controller = new AbortController();
  internals.local = local;
  const nav: Navigation = {
    url: new URL(entry.url),
    chain: newChain(true),
    controller,
    signal: AbortSignal.any([local.signal, session.controller.signal, controller.signal]),
    navigationType: driver.activation?.navigationType ?? 'push',
    initial: true,
    info: undefined,
    userInitiated: false,
    key: entry.key,
    rawState: entry.getState(),
    match: null,
  };
  const plan = planNavigation(router, nav);
  if (!plan) {return false;}
  if ('hop' in plan && plan.hop !== undefined) {return hop(router, plan.hop, nav).finished;}
  try {
    await run(router, plan, nav);
  } catch (error) {
    if (!isCurrent(router, nav)) {return false;}
    throw error;
  }
  return nav.chain.followUp ? nav.chain.followUp.finished : isCurrent(router, nav);
}

function planNavigation(router: RouterInstance, nav: Navigation): Plan | null {
  const { url } = nav;
  if (!option(router, 'intercept')!.call(router, url)) {return null;}
  const result = getMatcher(router).match(url);
  if (!result) {return notFoundPlan(router, url);}
  return redirectPlan(router, result, nav);
}

function notFoundPlan(router: RouterInstance, url: URL): Plan | null {
  const notFound = option(router, 'notFound');
  if (!notFound?.within(url)) {return null;}
  return { base: notFoundBase(notFound.name, getMatcher(router).matchPrefix(url), url), pending: null };
}

function redirectPlan(router: RouterInstance, result: MatcherResult, nav: Navigation): Plan {
  if (!result.redirect) {return { base: result, pending: null };}
  const target = callRedirect(result, nav);
  if (isThenable(target)) {return { base: result, pending: target };}
  if (target === undefined || target === null) {return { base: result, pending: null };}
  try {
    assertHopAllowed(router, nav);
    return { hop: targetHref(router, target) };
  } catch (error) {
    return { base: result, pending: rejection(error) };
  }
}

function callRedirect(result: MatcherResult, nav: Navigation) {
  try {
    return result.redirect!(toMatch(result, nav, nav.key, nav.rawState) as ActiveMatch, { signal: nav.signal });
  } catch (error) {
    return rejection(error);
  }
}

function assertHopAllowed(router: RouterInstance, nav: Navigation) {
  const maxRedirects = option(router, 'maxRedirects')!;
  if (nav.chain.hops >= maxRedirects) {throw new Error(`Redirect limit of ${ maxRedirects } exceeded`);}
}

function targetHref(router: RouterInstance, target: RedirectTarget) {
  if (typeof target !== 'string') {return router.url(target.name, target.params, { query: target.query });}
  const base = getDriver(router).currentEntry.url;
  const url = new URL(target, base);
  if (url.origin !== new URL(base).origin) {throw new Error(`Redirect target must be same-origin: ${ target }`);}
  return url.href;
}

function hop(router: RouterInstance, href: string, nav: Navigation): NavigationResult<boolean> {
  const chain: Chain = { initial: nav.chain.initial, hops: nav.chain.hops + 1, followUp: null, policy: nav.chain.policy };
  return navigateDriver(router, href, { history: 'replace', state: nav.rawState, info: nav.info }, chain);
}

function execute(router: RouterInstance, plan: Plan, nav: Navigation) {
  if (plan.hop === undefined) {return run(router, plan, nav);}
  nav.chain.followUp = hop(router, plan.hop, nav);
}

function isCurrent(router: RouterInstance, nav: Navigation) {
  const internals = stateFor(router);
  return !nav.signal.aborted && internals.current === nav.match;
}

async function run(router: RouterInstance, plan: Extract<Plan, { base: Base }>, nav: Navigation) {
  const match = commit(router, plan.base, nav);
  if (!match) {throw new DOMException('Navigation superseded', 'AbortError');}
  try {
    if (plan.pending && await redirected(router, nav, plan.pending)) {return;}
    await option(router, 'handler')?.call(router, match, { signal: match.signal });
  } catch (error) {
    if (!isCurrent(router, nav)) {throw new DOMException('Navigation superseded', 'AbortError');}
    router.triggerMethod('route:error', error, match);
    throw error;
  }
  if (!isCurrent(router, nav)) {throw new DOMException('Navigation superseded', 'AbortError');}
  router.triggerMethod('route:ready', match);
}

async function redirected(router: RouterInstance, nav: Navigation, pending: PromiseLike<RedirectTarget | null | undefined>) {
  const target = await pending;
  if (!isCurrent(router, nav)) {throw new DOMException('Navigation superseded', 'AbortError');}
  if (target === undefined || target === null) {return false;}
  assertHopAllowed(router, nav);
  nav.chain.followUp = hop(router, targetHref(router, target), nav);
  return true;
}

// Install current authority before abort listeners or route hooks can reenter.
// A superseding operation prevents this match's handler from running.
function commit(router: RouterInstance, base: Base, nav: Navigation) {
  const internals = stateFor(router);
  const entry = getDriver(router).currentEntry;
  const previous = internals.currentController;
  const match = toMatch(base, nav, entry.key, mark(router, entry)) as ActiveMatch;
  nav.match = match;
  internals.current = match;
  internals.currentController = nav.controller;
  previous?.abort();
  if (!isCurrent(router, nav)) {return null;}
  router.triggerMethod('route', match);
  return isCurrent(router, nav) ? match : null;
}

function mark(router: RouterInstance, entry: DriverEntry) {
  const stored = entry.getState();
  if (isMarked(stored) || !(stored === undefined || stored === null || isObject(stored))) {return stored;}
  const marked = withMarker(stored);
  getDriver(router).updateCurrentEntry({ state: marked });
  return marked;
}

export const Router = MnObject.extend({
  constructor: constructRouter,
  routes: [],
  persistParams: [],
  maxRedirects: 5,
  intercept: () => true,

  start(this: RouterInstance): Promise<boolean> {
    const internals = stateFor(this);
    if (internals.closed) { return Promise.resolve(false); }
    if (internals.session) {return internals.session.initial;}
    const driver = getDriver(this);
    const initial = Promise.withResolvers<boolean>();
    const session: Session = { controller: new AbortController(), initial: initial.promise };
    internals.session = session;
    driver.addEventListener('navigate', event => onNavigate(this, event), { signal: session.controller.signal });
    dispatchInitial(this, session).then(initial.resolve, initial.reject);
    return session.initial;
  },

  stop(this: RouterInstance) {
    stopRouting(this);
    return true;
  },

  navigate(this: RouterInstance, nameOrUrl: string, params?: Params | NavigateOptions, options?: NavigateOptions): NavigationResult<boolean> {
    const internals = stateFor(this);
    if (internals.closed || !internals.session) { return canceledNavigation(); }
    const isUrl = typeof nameOrUrl === 'string' && URL_FORM.test(nameOrUrl);
    const navigateOptions = ((isUrl ? params : options) ?? {}) as NavigateOptions;
    const href = isUrl ? urlTarget(this, nameOrUrl, navigateOptions) : this.url(nameOrUrl, params as Params | undefined, navigateOptions);
    const { history = 'auto', info, state } = navigateOptions;
    return navigateDriver(this, href, { history, info, state: entryState(this, href, history, state) }, newChain(false, navigateOptions));
  },

  url(this: RouterInstance, name: string, params: Params = {}, options: { query?: Query } = {}) {
    return getMatcher(this).url(name, withPersisted(this, name, params), options);
  },

  match(this: RouterInstance, url: URL | string) {
    const target = url instanceof URL ? url : new URL(url, URL.canParse(url) ? undefined : getDriver(this).currentEntry.url);
    const result = getMatcher(this).match(target);
    if (!result) {return null;}
    const idle = { navigationType: null, initial: false, info: undefined, signal: null, userInitiated: false };
    return toMatch(result, idle, '', undefined);
  },

  getCurrent(this: RouterInstance) {
    const internals = stateFor(this);
    return internals.current;
  },

  refresh(this: RouterInstance) {
    const internals = stateFor(this);
    if (!internals.session) {return Promise.resolve(false);}
    const entry = getDriver(this).currentEntry;
    if (!claims(this, new URL(entry.url))) {return Promise.resolve(false);}
    return navigateDriver(this, entry.url, { history: 'replace', state: entry.getState() }, newChain(false, { focusReset: 'manual', scroll: 'manual' })).finished;
  },

  mount(this: RouterInstance, routes: RouteDefinition[], options?: { parent?: string }) {
    return getMatcher(this).mount(routes, options);
  },

  getParamNames(this: RouterInstance, name: string) {
    return getMatcher(this).getParamNames(name);
  },

  hasRoute(this: RouterInstance, name: string) {
    return getMatcher(this).has(name);
  },

  back(this: RouterInstance) {
    const internals = stateFor(this);
    if (!this.canGoBack) {return Promise.resolve(false);}
    const driver = getDriver(this);
    const request = { key: driver.entries()[driver.currentEntry.index - 1].key, chain: newChain() };
    internals.traversals.add(request);
    try {
      return settle(driver.back(), request.chain).finished.finally(() => internals.traversals.delete(request));
    } catch (error) {
      internals.traversals.delete(request);
      throw error;
    }
  },

  updateState(this: RouterInstance, state: EntryState) {
    if (stateFor(this).closed || !stateFor(this).session) { return false; }
    const internals = stateFor(this);
    assertState(state);
    const entry = getDriver(this).currentEntry;
    const stored = entry.getState();
    const next = { ...(isObject(stored) ? stored : {}), ...state };
    getDriver(this).updateCurrentEntry({ state: next });
    if (internals.current?.key === entry.key) {internals.current.state = publicState(next);}
    return true;
  },

  destroy(this: RouterInstance, options?: unknown) {
    const internals = stateFor(this);
    if (internals.closed) { return this; }
    internals.closed = true;
    stopRouting(this);
    return MnObject.prototype.destroy.call(this, options);
  }
}) as unknown as RouterConstructor;

Object.defineProperty(Router.prototype, 'canGoBack', {
  configurable: true,
  get(this: RouterInstance) {
    const internals = stateFor(this);
    if (internals.closed || !internals.session) { return false; }
    const driver = getDriver(this);
    const { index } = driver.currentEntry;
    return index > 0 && isMarked(driver.entries()[index - 1].getState());
  }
});
