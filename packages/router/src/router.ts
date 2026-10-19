type Chain = { initial: boolean; hops: number; followUp: NavigationResult<boolean> | null };
type Session = { controller: AbortController; initial: Promise<boolean> | null };
type Navigation = {
  url: URL; chain: Chain; controller: AbortController; signal: AbortSignal;
  navigationType: DriverEvent['navigationType']; initial: boolean; info: unknown; userInitiated: boolean;
  key: string; rawState: unknown; match: ActiveMatch | null;
};
type Base = Pick<MatcherResult, 'name' | 'params' | 'url' | 'query' | 'meta' | 'branch' | 'alias'>;
type Plan = { hop: string; base?: never; pending?: never } |
  { hop?: never; base: Base; pending: PromiseLike<RedirectTarget | null | undefined> | null };

import type { EventMethods } from '@mnjs/utils';
import type { ActiveMatch, Match, Params, Query, EntryState, RouterOptions, NavigateOptions, Driver, DriverEntry, DriverEvent, NavigationResult, NavigationOptions, DriverNavigateOptions, RouteDefinition, MatcherResult, RedirectTarget } from './types.ts';
import { Events } from '@mnjs/utils';

import { Matcher } from './matcher.ts';
import { navigationDriver } from './drivers/navigation.ts';

const MARKER = '@mnjs/router';
const URL_FORM = /^(?:\/|[a-z][a-z\d+.-]*:\/\/)/i;
const noop = () => {};

const isObject = (value: unknown): value is EntryState => typeof value === 'object' && value !== null &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

const isThenable = (value: unknown): value is PromiseLike<RedirectTarget | null | undefined> =>
  typeof (value as PromiseLike<unknown> | null)?.then === 'function';

const isMarked = (state: unknown) => isObject(state) && state[MARKER] === true;

const newChain = (initial = false): Chain => ({ initial, hops: 0, followUp: null });

function rejection(error: unknown): Promise<never> {
  const promise = Promise.reject(error);
  promise.catch(noop);
  return promise;
}

function toSearchParams(query?: Query) {
  if (query === undefined || query === null) {return new URLSearchParams();}
  if (typeof query === 'string' || query instanceof URLSearchParams) {return new URLSearchParams(query);}
  const entries = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => [key, String(value)]);
  return new URLSearchParams(entries);
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
  return { name, params, query: new URLSearchParams(url.search), url, meta: {}, branch: [], alias: null };
}

function toMatch(base: Base, nav: Pick<Match, 'navigationType' | 'initial' | 'info' | 'signal' | 'userInitiated'>, key: string, rawState: unknown): Match {
  return {
    name: base.name,
    params: base.params,
    query: base.query,
    url: base.url,
    meta: base.meta,
    branch: base.branch,
    alias: base.alias,
    navigationType: nav.navigationType,
    initial: nav.initial,
    info: nav.info,
    state: publicState(rawState),
    key,
    signal: nav.signal,
    userInitiated: nav.userInitiated,
  };
}

export interface Router extends EventMethods {}

export class Router {
  #matcher: Matcher;
  #options: Required<Pick<RouterOptions, 'intercept' | 'persistParams' | 'maxRedirects'>> & RouterOptions;
  #driverOption: Driver | undefined;
  #resolvedDriver: Driver | null = null;
  #session: Session | null = null;
  #local: AbortController | null = null;
  #chain: Chain | null = null;
  #current: ActiveMatch | null = null;
  #currentController: AbortController | null = null;
  #traversals = new Set<{ key: string; chain: Chain }>();

  constructor(options: RouterOptions) {
    const { routes, driver, intercept = () => true, notFound, persistParams = [], handler, maxRedirects = 5 } = options;
    this.#matcher = new Matcher(routes);
    this.#driverOption = driver;
    this.#options = { routes, intercept, notFound, persistParams, handler, maxRedirects };
  }

  get #driver() {
    this.#resolvedDriver ??= this.#driverOption ?? navigationDriver();
    return this.#resolvedDriver;
  }

  start(): Promise<boolean> {
    if (this.#session) {return this.#session.initial!;}
    const driver = this.#driver;
    const session: Session = { controller: new AbortController(), initial: null };
    this.#session = session;
    driver.addEventListener('navigate', event => this.#onNavigate(event), { signal: session.controller.signal });
    session.initial = this.#dispatchInitial(session);
    return session.initial;
  }

  stop() {
    this.#abortLocal();
    this.#abortCurrent();
    this.#session?.controller.abort();
    this.#session = null;
    this.#traversals.clear();
  }

  navigate(nameOrUrl: string, params?: Params | NavigateOptions, options?: NavigateOptions): NavigationResult<boolean> {
    const isUrl = typeof nameOrUrl === 'string' && URL_FORM.test(nameOrUrl);
    const navigateOptions = ((isUrl ? params : options) ?? {}) as NavigateOptions;
    const href = isUrl ? this.#urlTarget(nameOrUrl, navigateOptions) : this.url(nameOrUrl, params as Params | undefined, navigateOptions);
    const { history = 'auto', info, state } = navigateOptions;
    return this.#navigateDriver(href, { history, info, state: this.#entryState(href, history, state) }, newChain());
  }

  // Explicit state replaces the entry's state. Omitted, a navigation that replaces the
  // current entry (explicit replace, or auto to the same URL) on the same path keeps
  // its plain-object state; a replace to another path starts empty, as the native API does.
  #entryState(href: string, history: NavigationOptions['history'], state: unknown) {
    if (state !== undefined) {return withMarker(state);}

    const entry = this.#driver.currentEntry;
    const current = new URL(entry.url);
    const target = new URL(href, current);
    const replaces = history === 'replace' || (history === 'auto' && target.href === current.href);
    const existing = replaces && target.pathname === current.pathname ? entry.getState() : undefined;

    return withMarker(isObject(existing) ? existing : undefined);
  }

  url(name: string, params: Params = {}, options: { query?: Query } = {}) {
    return this.#matcher.url(name, this.#withPersisted(name, params), options);
  }

  match(url: URL | string) {
    const result = this.#matcher.match(url);
    if (!result) {return null;}
    const idle = { navigationType: null, initial: false, info: undefined, signal: null, userInitiated: false };
    return toMatch(result, idle, '', undefined);
  }

  getCurrent() {
    return this.#current;
  }

  refresh() {
    if (!this.#session) {return Promise.resolve(false);}
    const entry = this.#driver.currentEntry;
    if (!this.#claims(new URL(entry.url))) {return Promise.resolve(false);}
    return this.#navigateDriver(entry.url, { history: 'replace', state: entry.getState() }, newChain()).finished;
  }

  mount(routes: RouteDefinition[], options?: { parent?: string }) {
    return this.#matcher.mount(routes, options);
  }

  getAliases() {
    return this.#matcher.getAliases();
  }

  getParamNames(name: string) {
    return this.#matcher.getParamNames(name);
  }

  hasRoute(name: string) {
    return this.#matcher.has(name);
  }

  get canGoBack() {
    const driver = this.#driver;
    const { index } = driver.currentEntry;
    return index > 0 && isMarked(driver.entries()[index - 1].getState());
  }

  back() {
    if (!this.canGoBack) {return Promise.resolve(false);}
    const driver = this.#driver;
    const request = { key: driver.entries()[driver.currentEntry.index - 1].key, chain: newChain() };
    this.#traversals.add(request);
    try {
      return this.#settle(driver.back(), request.chain).finished.finally(() => this.#traversals.delete(request));
    } catch (error) {
      this.#traversals.delete(request);
      throw error;
    }
  }

  updateState(state: EntryState) {
    assertState(state);
    const entry = this.#driver.currentEntry;
    const stored = entry.getState();
    const next = { ...(isObject(stored) ? stored : {}), ...state };
    this.#driver.updateCurrentEntry({ state: next });
    if (this.#current?.key === entry.key) {this.#current.state = publicState(next);}
  }

  #withPersisted(name: string, params: Params) {
    const current = this.#current;
    if (!current || !this.#options.persistParams.length) {return params;}
    const names = this.#matcher.getParamNames(name);
    const persisted = this.#options.persistParams
      .filter(key => names.includes(key) && (params[key] === undefined || params[key] === null) && key in current.params)
      .map(key => [key, current.params[key]]);
    return { ...Object.fromEntries(persisted), ...params };
  }

  #urlTarget(url: string, { query }: NavigateOptions) {
    const target = new URL(url, this.#driver.currentEntry.url);
    if (query !== undefined) {target.search = toSearchParams(query).toString();}
    return target.href;
  }

  #navigateDriver(href: string, options: DriverNavigateOptions, chain: Chain): NavigationResult<boolean> {
    this.#chain = chain;
    try {
      return this.#settle(this.#driver.navigate(href, options), chain);
    } finally {
      this.#chain = null;
    }
  }

  // A navigation superseded by its own redirect resolves with the redirect's outcome.
  #settle(result: NavigationResult, chain: Chain): NavigationResult<boolean> {
    const follow = (ok: boolean, key: 'committed' | 'finished') => (ok || !chain.followUp ? ok : chain.followUp[key]);
    const committed = outcome(result.committed).then(ok => follow(ok, 'committed'));
    const finished = outcome(result.finished).then(ok => follow(ok, 'finished'));
    committed.catch(noop);
    finished.catch(noop);
    return { committed, finished };
  }

  #takeChain(event: DriverEvent) {
    if (event.navigationType === 'traverse') {
      const request = [...this.#traversals].find(item => item.key === event.destination.key);
      if (request) {
        this.#traversals.delete(request);
        return request.chain;
      }
    }
    const chain = this.#chain ?? newChain();
    this.#chain = null;
    return chain;
  }

  #abortLocal() {
    this.#local?.abort();
    this.#local = null;
  }

  #abortCurrent() {
    this.#currentController?.abort();
    this.#currentController = null;
  }

  #intercepts(event: DriverEvent, url: URL) {
    if (event.defaultPrevented || event.signal.aborted || !event.canIntercept || event.hashChange || event.navigationType === 'reload') {return false;}
    if (event.downloadRequest !== null || event.formData !== null) {return false;}
    return url.origin === new URL(this.#driver.currentEntry.url).origin;
  }

  #claims(url: URL) {
    if (!this.#options.intercept(url)) {return false;}
    return Boolean(this.#matcher.match(url) ?? this.#options.notFound?.within(url));
  }

  #onNavigate(event: DriverEvent) {
    const chain = this.#takeChain(event);
    const url = new URL(event.destination.url);
    if (!this.#intercepts(event, url)) {return;}
    const nav = this.#navigationFor(event, url, chain);
    const plan = this.#plan(nav);
    if (!plan) {return;}
    this.#abortLocal();
    event.intercept({ handler: () => this.#execute(plan, nav), focusReset: 'manual', scroll: 'manual' });
  }

  #navigationFor(event: DriverEvent, url: URL, chain: Chain): Navigation {
    const controller = new AbortController();
    return {
      url,
      chain,
      controller,
      signal: AbortSignal.any([event.signal, this.#session!.controller.signal, controller.signal]),
      navigationType: event.navigationType,
      initial: chain.initial,
      info: event.info,
      userInitiated: event.userInitiated,
      key: event.destination.key,
      rawState: event.destination.getState(),
      match: null,
    };
  }

  async #dispatchInitial(session: Session): Promise<boolean> {
    const entry = this.#driver.currentEntry;
    const local = new AbortController();
    const controller = new AbortController();
    this.#local = local;
    const nav: Navigation = {
      url: new URL(entry.url),
      chain: newChain(true),
      controller,
      signal: AbortSignal.any([local.signal, session.controller.signal, controller.signal]),
      navigationType: 'push',
      initial: true,
      info: undefined,
      userInitiated: false,
      key: entry.key,
      rawState: entry.getState(),
      match: null,
    };
    const plan = this.#plan(nav);
    if (!plan) {return false;}
    if ('hop' in plan && plan.hop !== undefined) {return this.#hop(plan.hop, nav).finished;}
    try {
      await this.#run(plan, nav);
    } catch (error) {
      if (!this.#isCurrent(nav)) {return false;}
      throw error;
    }
    return nav.chain.followUp ? nav.chain.followUp.finished : this.#isCurrent(nav);
  }

  /*
   * A plan is null (not the router's), `{ hop }` (replace the URL first), or
   * `{ base, pending }` (dispatch; `pending` is an async redirect in flight).
   */
  #plan(nav: Navigation): Plan | null {
    const { url } = nav;
    if (!this.#options.intercept(url)) {return null;}
    const result = this.#matcher.match(url);
    if (!result) {return this.#notFoundPlan(url);}
    if (result.alias !== null && result.aliasPolicy === 'canonicalize') {
      try {
        this.#assertHopAllowed(nav);
        const canonical = this.#matcher.url(result.name, result.params, { query: result.query });
        return { hop: `${ canonical }${ url.hash }` };
      } catch (error) {
        return { base: result, pending: rejection(error) };
      }
    }
    return this.#redirectPlan(result, nav);
  }

  #notFoundPlan(url: URL): Plan | null {
    const { notFound } = this.#options;
    if (!notFound?.within(url)) {return null;}
    return { base: notFoundBase(notFound.name, this.#matcher.matchPrefix(url), url), pending: null };
  }

  #redirectPlan(result: MatcherResult, nav: Navigation): Plan {
    if (!result.redirect) {return { base: result, pending: null };}
    const target = this.#callRedirect(result, nav);
    if (isThenable(target)) {return { base: result, pending: target };}
    if (target === undefined || target === null) {return { base: result, pending: null };}
    try {
      this.#assertHopAllowed(nav);
      return { hop: this.#targetHref(target) };
    } catch (error) {
      return { base: result, pending: rejection(error) };
    }
  }

  #callRedirect(result: MatcherResult, nav: Navigation) {
    try {
      return result.redirect!(toMatch(result, nav, nav.key, nav.rawState) as ActiveMatch, { signal: nav.signal });
    } catch (error) {
      return rejection(error);
    }
  }

  #assertHopAllowed(nav: Navigation) {
    const { maxRedirects } = this.#options;
    if (nav.chain.hops >= maxRedirects) {throw new Error(`Redirect limit of ${ maxRedirects } exceeded`);}
  }

  #targetHref(target: RedirectTarget) {
    if (typeof target !== 'string') {return this.url(target.name, target.params, { query: target.query });}
    const base = this.#driver.currentEntry.url;
    const url = new URL(target, base);
    if (url.origin !== new URL(base).origin) {throw new Error(`Redirect target must be same-origin: ${ target }`);}
    return url.href;
  }

  #hop(href: string, nav: Navigation): NavigationResult<boolean> {
    const chain: Chain = { initial: nav.chain.initial, hops: nav.chain.hops + 1, followUp: null };
    return this.#navigateDriver(href, { history: 'replace', state: nav.rawState, info: nav.info }, chain);
  }

  #execute(plan: Plan, nav: Navigation) {
    if (plan.hop === undefined) {return this.#run(plan, nav);}
    nav.chain.followUp = this.#hop(plan.hop, nav);
  }

  #isCurrent(nav: Navigation) {
    return !nav.signal.aborted && this.#current === nav.match;
  }

  async #run(plan: Extract<Plan, { base: Base }>, nav: Navigation) {
    const match = this.#commit(plan.base, nav);
    if (!match) {throw new DOMException('Navigation superseded', 'AbortError');}
    try {
      if (plan.pending && await this.#redirected(nav, plan.pending)) {return;}
      await this.#options.handler?.(match, { signal: match.signal });
    } catch (error) {
      if (!this.#isCurrent(nav)) {throw new DOMException('Navigation superseded', 'AbortError');}
      this.trigger('route:error', error, match);
      throw error;
    }
    if (!this.#isCurrent(nav)) {throw new DOMException('Navigation superseded', 'AbortError');}
    this.trigger('route:ready', match);
  }

  // True when the navigation was superseded or replaced by the redirect target.
  async #redirected(nav: Navigation, pending: PromiseLike<RedirectTarget | null | undefined>) {
    const target = await pending;
    if (!this.#isCurrent(nav)) {throw new DOMException('Navigation superseded', 'AbortError');}
    if (target === undefined || target === null) {return false;}
    this.#assertHopAllowed(nav);
    nav.chain.followUp = this.#hop(this.#targetHref(target), nav);
    return true;
  }

  // Installs the match before anything it triggers can run, so a navigation or
  // stop() started from an abort or route listener supersedes this one. Returns
  // null when that happened and the handler must not run.
  #commit(base: Base, nav: Navigation) {
    const entry = this.#driver.currentEntry;
    const previous = this.#currentController;
    const match = toMatch(base, nav, entry.key, this.#mark(entry)) as ActiveMatch;
    nav.match = match;
    this.#current = match;
    this.#currentController = nav.controller;
    previous?.abort();
    if (!this.#isCurrent(nav)) {return null;}
    this.trigger('route', match);
    return this.#isCurrent(nav) ? match : null;
  }

  #mark(entry: DriverEntry) {
    const stored = entry.getState();
    if (isMarked(stored) || !(stored === undefined || stored === null || isObject(stored))) {return stored;}
    const marked = withMarker(stored);
    this.#driver.updateCurrentEntry({ state: marked });
    return marked;
  }
}

Object.assign(Router.prototype, Events);
