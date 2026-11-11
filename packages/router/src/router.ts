type InterceptionPolicy = Readonly<Pick<NavigateOptions, 'focusReset' | 'scroll'>>;
type Chain = { initial: boolean; hops: number; followUp: NavigationResult<boolean> | null; policy: InterceptionPolicy; dispatch?: { match: ActiveMatch | null }; failure?: { error: unknown } };
type Session = { controller: AbortController; revision: number };
type Navigation = {
  url: URL; chain: Chain; controller: AbortController; signal: AbortSignal;
  navigationType: DriverEvent['navigationType']; initial: boolean; info: unknown; userInitiated: boolean;
  key: string; rawState: unknown; match: ActiveMatch | null;
  registration?: object;
  release?: () => void;
};
type Base = Pick<MatcherResult, 'name' | 'params' | 'url' | 'query' | 'meta' | 'branch'>;
type Plan = { hop: string; base?: never; pending?: never } |
  { hop?: never; base: Base; pending: PromiseLike<RedirectTarget | null | undefined> | null; handler?: RouteHandler };

import { Application } from 'marionette';
import type { ApplicationInstance, ApplicationConstructor } from 'marionette';
import type { ActiveMatch, Match, RouteErrorContext, InitialDispatchResult, Params, Query, EntryState, RouterOptions, NavigateOptions, Driver, DriverEntry, DriverEvent, NavigationResult, NavigationOptions, DriverNavigateOptions, RouteTable, MountOptions, RouteHandler, MatcherResult, RedirectTarget } from './types.ts';

import type { NamedRouteArgs, RouteNames } from './route-types.ts';
import { Matcher, URL_FORM } from './matcher.ts';
import type { RegisteredMatch } from './matcher.ts';
import { toSearchParams } from './query.ts';
import { navigationDriver } from './drivers/navigation.ts';

const MARKER = '@mnjs/router';
const noop = () => {};

class NavigationCancelled extends DOMException {
  constructor() { super('Navigation superseded', 'AbortError'); }
}

const isObject = (value: unknown): value is EntryState => typeof value === 'object' && value !== null &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

const isThenable = (value: unknown): value is PromiseLike<RedirectTarget | null | undefined> =>
  typeof (value as PromiseLike<unknown> | null)?.then === 'function';

const isMarked = (state: unknown) => isObject(state) && state[MARKER] === true;

function newChain(initial = false, { focusReset, scroll }: InterceptionPolicy = {}): Chain {
  for (const [name, value] of Object.entries({ focusReset, scroll })) {
    if (value !== undefined && value !== 'manual' && value !== 'after-transition') {
      throw new TypeError(`${ name } must be "manual" or "after-transition"`);
    }
  }
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

function outcome(promise: Promise<unknown>, chain: Chain) {
  return promise.then(() => true, error => {
    if (error?.name === 'AbortError' && chain.failure?.error !== error) {return false;}
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

export interface RouterMethods extends Omit<RouterOptions, keyof ApplicationInstance> {
  navigate(nameOrUrl: string, params?: Params | NavigateOptions, options?: NavigateOptions): NavigationResult<boolean>;
  url(name: string, params?: Params, options?: { query?: Query }): string;
  match(url: URL | string): Match | null;
  getCurrent(): ActiveMatch | null;
  getInitialDispatch(): Promise<InitialDispatchResult> | null;
  refresh(): Promise<boolean>;
  mount(routes: RouteTable, options?: MountOptions): () => void;
  getParamNames(name: string): string[];
  hasRoute(name: string): boolean;
  canGoBack(): boolean;
  back(): Promise<boolean>;
  updateState(state: EntryState): boolean;
}
interface LiteralRouteMethods<Routes extends RouteTable> {
  url(...args: NamedRouteArgs<Routes, { query?: Query }>): string;
  navigate(...args: NamedRouteArgs<Routes, NavigateOptions>): NavigationResult<boolean>;
  navigate(url: `/${ string }` | `${ string }://${ string }`, options?: NavigateOptions): NavigationResult<boolean>;
}
type RouteMethods<Routes extends RouteTable> = string extends RouteNames<Routes>
  ? Pick<RouterMethods, 'url' | 'navigate'> : LiteralRouteMethods<Routes>;
type GeneralRouterInstance = Omit<ApplicationInstance<RouterOptions, unknown>, keyof RouterMethods> & RouterMethods;
export type RouterInstance<Routes extends RouteTable = RouteTable> =
  Omit<GeneralRouterInstance, 'url' | 'navigate'> & RouteMethods<Routes>;
type CoreRouterConstructor = ApplicationConstructor<RouterMethods, [options?: RouterOptions]>;
type ConstructedRouter<Routes extends RouteTable, Options extends RouterOptions> =
  Omit<InstanceType<ApplicationConstructor<RouterMethods, [options: Options]>>, 'url' | 'navigate'> & RouteMethods<Routes>;
export type RouterConstructor = Omit<CoreRouterConstructor, never> & {
  new <const Routes extends RouteTable = RouteTable, Options extends RouterOptions = RouterOptions>(
    options?: Options & { routes?: Routes | ((this: RouterInstance) => Routes) }
  ): ConstructedRouter<Routes, Options>;
  (this: object, options?: RouterOptions): void;
};

type RouterState = {
  matcher: Matcher | null;
  resolvedDriver: Driver | null;
  session: Session | null;
  local: AbortController | null;
  chain: Chain | null;
  queued: { blocked: Chain | null } | null;
  current: ActiveMatch | null;
  currentController: AbortController | null;
  currentNavigation: Navigation | null;
  pending: Set<Navigation>;
  initialDispatch: Promise<InitialDispatchResult> | null;
  traversals: Set<{ key: string; chain: Chain }>;
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
    internals.matcher = new Matcher(typeof routes === 'function' ? routes.call(router) : routes, router);
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
  internals.queued = null;
  internals.traversals.clear();
  local?.abort();
  currentController?.abort();
  session?.controller.abort();
}
function constructRouter(this: RouterInstance, options?: RouterOptions) {
  states.set(this, {
    matcher: null, resolvedDriver: null, session: null, local: null, chain: null, queued: null,
    current: null, currentController: null, currentNavigation: null, pending: new Set(), initialDispatch: null, traversals: new Set()
  });
  // Application establishes its stopping guard before notifying listeners, so
  // abort callbacks cannot re-enable routing during ancestor teardown.
  this.on({ start: () => startRouting(this), 'before:stop': () => stopRouting(this), 'before:destroy': () => stopRouting(this) });
  Application.call(this, options);
  getMatcher(this);
}

function startRouting(router: RouterInstance) {
  // onStart is an ordinary synchronous Application hook. It may stop/destroy
  // the app before event listeners run; retained restart keeps its session.
  const internals = stateFor(router);
  if (!router.isRunning() || internals.session) {return;}
  const initial = Promise.withResolvers<InitialDispatchResult>();
  internals.initialDispatch = initial.promise;
  try {
    const driver = getDriver(router);
    const session: Session = { controller: new AbortController(), revision: 0 };
    internals.session = session;
    driver.addEventListener('navigate', event => onNavigate(router, event), { signal: session.controller.signal });
    // Activation and initial page readiness have distinct observable outcomes.
    dispatchInitial(router, session).then(initial.resolve);
  } catch (error) {
    initial.resolve({ status: 'failed', error, match: null });
    // A failure acquiring our own binding must leave activation retryable.
    // Consumer notification failures keep the ordinary Application contract.
    stopRouting(router);
    try {
      router.stop();
    } catch (cleanupError) {
      queueMicrotask(() => {throw cleanupError;});
    }
    throw error;
  }
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

function withPersisted(router: RouterInstance, name: string, params: Params, source = stateFor(router).current?.params) {
  if (!source || !option(router, 'persistParams')!.length) {return params;}
  const names = getMatcher(router).getParamNames(name);
  const persisted = option(router, 'persistParams')!
    .filter(key => names.includes(key) && !Object.hasOwn(params, key) && Object.hasOwn(source, key))
    .map(key => [key, source[key]]);
  return { ...Object.fromEntries(persisted), ...params };
}

function urlTarget(router: RouterInstance, url: string, { query }: NavigateOptions) {
  const target = new URL(url, getDriver(router).currentEntry.url);
  if (query !== undefined) {target.search = toSearchParams(query).toString();}
  return target.href;
}

function queueNavigation(router: RouterInstance, href: string, options: DriverNavigateOptions, chain: Chain): NavigationResult<boolean> {
  const internals = stateFor(router);
  const target = new URL(href, getDriver(router).currentEntry.url).href;
  const committed = Promise.withResolvers<boolean>();
  const finished = Promise.withResolvers<boolean>();
  committed.promise.catch(noop); finished.promise.catch(noop);
  const queued = internals.queued = { blocked: internals.chain };
  internals.session!.revision++;
  queueMicrotask(() => {
    if (internals.queued !== queued) {
      committed.resolve(false); finished.resolve(false); return;
    }
    internals.queued = null;
    internals.currentNavigation?.controller.abort();
    try {
      const result = navigateDriver(router, target, options, chain);
      result.committed.then(committed.resolve, committed.reject);
      result.finished.then(finished.resolve, finished.reject);
    } catch (error) {committed.reject(error); finished.reject(error);}
  });
  return { committed: committed.promise, finished: finished.promise };
}

function navigateDriver(router: RouterInstance, href: string, options: DriverNavigateOptions, chain: Chain): NavigationResult<boolean> {
  const internals = stateFor(router);
  const current = internals.currentNavigation;
  // Native navigation can resume an older request after a synchronous abort
  // listener navigates, even leaving that request's result pending. Defer only
  // public requests reentering this boundary; controlled redirect hops proceed.
  if (chain.hops === 0 && current?.signal.aborted && !current.controller.signal.aborted) {
    return queueNavigation(router, href, options, chain);
  }
  internals.queued = null;
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
  const committed = outcome(result.committed, chain).then(ok => follow(ok, 'committed'));
  const finished = outcome(result.finished, chain).then(ok => follow(ok, 'finished'));
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

function intercepts(router: RouterInstance, event: DriverEvent, url: URL, chain: Chain) {
  // Ordinary hash changes stay native. A redirect's fragment destination still
  // owns the handler/readiness promised by the internally followed chain.
  if (!event.canIntercept || (event.hashChange && chain.hops === 0) || event.navigationType === 'reload') {return false;}
  if (event.downloadRequest !== null || event.formData !== null) {return false;}
  return url.origin === new URL(getDriver(router).currentEntry.url).origin;
}

function claims(router: RouterInstance, url: URL) {
  if (!option(router, 'intercept')!.call(router, url)) {return false;}
  return Boolean(getMatcher(router).match(url) ?? option(router, 'notFound')?.within(url));
}

function onNavigate(router: RouterInstance, event: DriverEvent) {
  const internals = stateFor(router);
  internals.session!.revision++;
  if (event.defaultPrevented || event.signal.aborted) {return;}
  const chain = takeChain(router, event);
  // Only a live event can supersede queued authority, even if it stays native.
  if (internals.queued?.blocked && internals.queued.blocked !== chain) {internals.queued = null;}
  const url = new URL(event.destination.url);
  if (!intercepts(router, event, url, chain)) {return;}
  const nav = navigationFor(router, event, url, chain);
  let task: () => void | Promise<void>;
  try {
    if (internals.queued) {
      internals.queued.blocked = chain;
      nav.controller.abort();
      if (event.cancelable) {event.preventDefault();}
      task = noop;
    } else {
      const plan = planNavigation(router, nav);
      if (!plan) {nav.release!(); return;}
      task = () => execute(router, plan, nav);
    }
  } catch (error) {
    // Claim failed planning as a rejected transition rather than letting a
    // synchronous listener exception fall through to document navigation.
    task = () => {throw error;};
  }
  // Planning callbacks can start a newer driver navigation. Router cancellation
  // alone still needs an intercepted canceled attempt, rather than document fallback.
  if (event.defaultPrevented || event.signal.aborted) {nav.release!(); return;}
  abortLocal(router);
  if (internals.queued) {
    internals.queued.blocked = chain;
    nav.controller.abort();
    if (event.cancelable) {event.preventDefault();}
  }
  // Aborting initial work can synchronously navigate from an abort listener too.
  if (event.defaultPrevented || event.signal.aborted) {nav.release!(); return;}
  event.intercept({ handler: () => waitForAttempt(router, nav, task), ...chain.policy });
}

function navigationFor(router: RouterInstance, event: DriverEvent, url: URL, chain: Chain): Navigation {
  const internals = stateFor(router);
  const controller = new AbortController();
  const nav: Navigation = {
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
  registerPending(router, nav);
  return nav;
}

// A later driver listener can veto without ever invoking our handler. Abort
// owns cleanup from registration onward; successful/unclaimed work releases it.
function registerPending(router: RouterInstance, nav: Navigation) {
  const pending = stateFor(router).pending;
  const release = nav.release = () => {
    pending.delete(nav);
    nav.signal.removeEventListener('abort', release);
  };
  pending.add(nav);
  nav.signal.addEventListener('abort', release, { once: true });
  if (nav.signal.aborted) {release();}
}

function dispatchInitial(router: RouterInstance, session: Session) {
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
  nav.chain.dispatch = { match: null };
  registerPending(router, nav);
  return initialOutcome(router, nav);
}

async function initialOutcome(router: RouterInstance, nav: Navigation): Promise<InitialDispatchResult> {
  try {
    try {
      await waitForAttempt(router, nav, async() => {
        const plan = planNavigation(router, nav);
        if (plan) {await execute(router, plan, nav);}
      });
    } catch (error) {
      // A redirect cancels its source; its destination owns the final outcome.
      if (!nav.chain.followUp) {throw error;}
    }
    const finished = nav.chain.followUp ? await nav.chain.followUp.finished : !nav.signal.aborted;
    if (!finished) {return { status: 'cancelled' };}
    const match = nav.chain.dispatch!.match;
    return match ? { status: 'matched', match } : { status: 'unmatched' };
  } catch (error) {
    if (error instanceof NavigationCancelled) {return { status: 'cancelled' };}
    return { status: 'failed', error, match: nav.chain.dispatch!.match };
  }
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

function redirectPlan(router: RouterInstance, result: RegisteredMatch, nav: Navigation): Plan {
  nav.registration = result.registration;
  const handler = result.handler;
  if (!result.redirect) {return { base: result, pending: null, handler };}
  const target = callRedirect(result, nav);
  if (isThenable(target)) {
    const pending = Promise.resolve(target);
    pending.catch(noop);
    return { base: result, pending, handler };
  }
  if (target === undefined || target === null) {return { base: result, pending: null, handler };}
  try {
    assertHopAllowed(router, nav);
    return { hop: targetHref(router, target, nav.url, result.params) };
  } catch (error) {
    return { base: result, pending: rejection(error), handler };
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

function targetHref(router: RouterInstance, target: RedirectTarget, base: URL, params: Record<string, string>) {
  if (typeof target !== 'string') {
    const url = new URL(getMatcher(router).url(target.name, withPersisted(router, target.name, target.params ?? {}, params), { query: target.query }), base);
    if (target.hash !== undefined) {url.hash = target.hash;}
    return url.href;
  }
  const url = new URL(target, base);
  if (url.origin !== base.origin) {throw new Error(`Redirect target must be same-origin: ${ target }`);}
  return url.href;
}

function hop(router: RouterInstance, href: string, nav: Navigation): NavigationResult<boolean> {
  const chain: Chain = { initial: nav.chain.initial, hops: nav.chain.hops + 1, followUp: null, policy: nav.chain.policy, dispatch: nav.chain.dispatch };
  if (chain.dispatch) {chain.dispatch.match = null;}
  return navigateDriver(router, href, { history: 'replace', state: nav.rawState, info: nav.info }, chain);
}

function execute(router: RouterInstance, plan: Plan, nav: Navigation) {
  // Initial dispatch also plans directly; no canceled plan may commit or redirect.
  if (nav.signal.aborted) {throw new NavigationCancelled();}
  if (plan.hop === undefined) {return run(router, plan, nav);}
  nav.chain.followUp = hop(router, plan.hop, nav);
}

function isCurrent(router: RouterInstance, nav: Navigation) {
  const internals = stateFor(router);
  return !nav.signal.aborted && internals.current === nav.match;
}

// One boundary owns each attempt, including planning, commit and notifications.
// Redirect destinations report their own errors, outside the source attempt.
async function attempt(router: RouterInstance, nav: Navigation, task: () => void | Promise<void>) {
  try {
    if (nav.signal.aborted) {throw new NavigationCancelled();}
    await task();
  } catch (error) {
    if (nav.signal.aborted || (nav.match && !isCurrent(router, nav))) {
      throw new NavigationCancelled();
    }
    nav.chain.failure = { error };
    reportError(router, error, nav.match, { info: nav.info });
    throw error;
  } finally {
    nav.release!();
  }
}

function reportError(router: RouterInstance, error: unknown, match: ActiveMatch | null, context: RouteErrorContext) {
  try {
    router.triggerMethod('route:error', error, match, context);
  } catch (notificationError) {
    // Reporting failures remain visible even for automatically dispatched work.
    queueMicrotask(() => {throw notificationError;});
  }
}

function waitForAttempt(router: RouterInstance, nav: Navigation, task: () => void | Promise<void>) {
  return cancellable(attempt(router, nav, task), nav.signal).finally(() => nav.release!());
}

// Ownership cancellation settles even when consumer work ignores the signal.
// The original work remains observed and must check its signal before effects.
function cancellable(work: void | Promise<void>, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new NavigationCancelled());
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(work).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    if (signal.aborted) {abort();}
  });
}

function reconcileRegistrations(router: RouterInstance) {
  const internals = stateFor(router);
  const candidates = new Set(internals.pending);
  if (internals.currentNavigation) {candidates.add(internals.currentNavigation);}
  // Snapshot retirement and clear current authority before any abort callback
  // can remount a parent or navigate through a newly active registration.
  const removed = [...candidates].filter(nav => nav.registration && !getMatcher(router).hasRegistration(nav.registration));
  if (internals.currentNavigation && removed.includes(internals.currentNavigation)) {
    internals.current = null;
    internals.currentController = null;
    internals.currentNavigation = null;
  }
  for (const nav of removed) {nav.controller.abort();}
}

async function run(router: RouterInstance, plan: Extract<Plan, { base: Base }>, nav: Navigation) {
  const match = commit(router, plan.base, nav);
  if (!match) {throw new NavigationCancelled();}
  if (plan.pending && await redirected(router, nav, plan.pending)) {return;}
  if (!isCurrent(router, nav)) {throw new NavigationCancelled();}
  await (plan.handler ?? option(router, 'handler'))?.call(router, match, { signal: match.signal });
  if (!isCurrent(router, nav)) {throw new NavigationCancelled();}
  router.triggerMethod('route:ready', match);
}

async function redirected(router: RouterInstance, nav: Navigation, pending: PromiseLike<RedirectTarget | null | undefined>) {
  const target = await pending;
  if (!isCurrent(router, nav)) {throw new NavigationCancelled();}
  if (target === undefined || target === null) {return false;}
  assertHopAllowed(router, nav);
  nav.chain.followUp = hop(router, targetHref(router, target, nav.url, nav.match!.params), nav);
  return true;
}

// Install current authority before abort listeners or route hooks can reenter.
// A superseding operation prevents this match's handler from running.
function commit(router: RouterInstance, base: Base, nav: Navigation) {
  const internals = stateFor(router);
  const entry = getDriver(router).currentEntry;
  const previous = internals.currentController;
  const match = toMatch(base, nav, entry.key, mark(router, entry, nav.signal)) as ActiveMatch;
  if (nav.signal.aborted) {return null;}
  nav.match = match;
  internals.current = match;
  internals.currentController = nav.controller;
  internals.currentNavigation = nav;
  if (nav.chain.dispatch) {nav.chain.dispatch.match = match;}
  previous?.abort();
  if (!isCurrent(router, nav)) {return null;}
  router.triggerMethod('route', match);
  return isCurrent(router, nav) ? match : null;
}

function mark(router: RouterInstance, entry: DriverEntry, signal: AbortSignal) {
  const stored = entry.getState();
  if (isMarked(stored) || !(stored === undefined || stored === null || isObject(stored))) {return stored;}
  const marked = withMarker(stored);
  getDriver(router).updateCurrentEntry({ state: marked });
  return signal.aborted ? marked : entry.getState();
}

export const Router = /* @__PURE__ */ Application.extend({
  constructor: constructRouter,
  routes: [],
  persistParams: [],
  maxRedirects: 5,
  intercept: () => true,

  navigate(this: RouterInstance, nameOrUrl: string, params?: Params | NavigateOptions, options?: NavigateOptions): NavigationResult<boolean> {
    const internals = stateFor(this);
    if (!internals.session) { return canceledNavigation(); }
    const isUrl = typeof nameOrUrl === 'string' && URL_FORM.test(nameOrUrl);
    const navigateOptions = ((isUrl ? params : options) ?? {}) as NavigateOptions;
    const chain = newChain(false, navigateOptions);
    const href = isUrl ? urlTarget(this, nameOrUrl, navigateOptions) : this.url(nameOrUrl, params as Params | undefined, navigateOptions);
    const { history = 'auto', info, state } = navigateOptions;
    return navigateDriver(this, href, { history, info, state: entryState(this, href, history, state) }, chain);
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

  getInitialDispatch(this: RouterInstance) {
    return stateFor(this).initialDispatch;
  },

  async refresh(this: RouterInstance) {
    const internals = stateFor(this);
    const session = internals.session;
    if (!session) {return false;}
    const revision = session.revision;
    const entry = getDriver(this).currentEntry;
    try {
      if (!claims(this, new URL(entry.url))) {return false;}
    } catch (error) {
      if (internals.session !== session || session.revision !== revision) {return false;}
      reportError(this, error, null, { info: undefined });
      throw error;
    }
    if (internals.session !== session || session.revision !== revision) {return false;}
    const stored = entry.getState();
    if (internals.session !== session || session.revision !== revision) {return false;}
    return navigateDriver(this, entry.url, { history: 'replace', state: stored }, newChain(false, { focusReset: 'manual', scroll: 'manual' })).finished;
  },

  mount(this: RouterInstance, routes: RouteTable, options?: MountOptions) {
    const owner = options?.owner;
    if (owner?.isDestroyed()) {throw new Error('Cannot mount routes for a destroyed owner');}
    const remove = getMatcher(this).mount(routes, options);
    let mounted = true;
    const unmount = () => {
      if (!mounted) {return;}
      mounted = false;
      owner?.off('before:destroy', unmount);
      this.off('before:destroy', unmount);
      remove();
      reconcileRegistrations(this);
    };
    owner?.on('before:destroy', unmount);
    this.on('before:destroy', unmount);
    if (owner?.isDestroyed()) {unmount();}
    return unmount;
  },

  getParamNames(this: RouterInstance, name: string) {
    return getMatcher(this).getParamNames(name);
  },

  hasRoute(this: RouterInstance, name: string) {
    return getMatcher(this).has(name);
  },

  back(this: RouterInstance) {
    const internals = stateFor(this);
    if (!this.canGoBack()) {return Promise.resolve(false);}
    internals.queued = null;
    internals.session!.revision++;
    const driver = getDriver(this);
    const key = driver.entries()[driver.currentEntry.index - 1].key;
    // Drivers may coalesce queued traversals. Every caller must then follow the
    // same redirects and distinguish the same operational failure from abort.
    const request = [...internals.traversals].find(item => item.key === key) ?? { key, chain: newChain() };
    internals.traversals.add(request);
    try {
      return settle(driver.back(), request.chain).finished.finally(() => internals.traversals.delete(request));
    } catch (error) {
      internals.traversals.delete(request);
      throw error;
    }
  },

  updateState(this: RouterInstance, state: EntryState) {
    if (!stateFor(this).session) { return false; }
    const internals = stateFor(this);
    assertState(state);
    const entry = getDriver(this).currentEntry;
    const stored = entry.getState();
    const next = { ...(isObject(stored) ? stored : {}), ...state };
    if (isMarked(stored)) {next[MARKER] = true;} else {delete next[MARKER];}
    const match = internals.current;
    getDriver(this).updateCurrentEntry({ state: next });
    if (internals.current === match && match?.key === entry.key) {
      const storedAfter = entry.getState();
      if (internals.current === match) {match.state = publicState(storedAfter);}
    }
    return true;
  },

  canGoBack(this: RouterInstance) {
    const internals = stateFor(this);
    if (!internals.session) { return false; }
    const driver = getDriver(this);
    const { index } = driver.currentEntry;
    return index > 0 && isMarked(driver.entries()[index - 1].getState());
  }
}) as unknown as RouterConstructor;
