import { Pattern, normalizePathname, canonicalPathname, hasValue } from './pattern.ts';
import { toSearchParams } from './query.ts';
import { resolveMethod } from '@mnjs/utils';
import type { CompiledPattern } from './pattern.ts';
import type { BranchEntry, RouteDefinition, RouteTable, RouteHandler, MountOptions, Params, Query, MatcherResult } from './types.ts';

type RegisteredRoute = Omit<RouteDefinition, 'handler' | 'children'> & { handler?: RouteHandler; children?: RegisteredRoute[] };
type CompiledBranch = Omit<BranchEntry, 'params'> & { names: string[] };
type Node = { path: string; names: string[]; meta: Record<string, unknown>; branch: CompiledBranch[] };
type Priority = { ranks: number[]; mount: number };
type Route = Node & Priority & { name: string; pattern: Pattern; compiled: CompiledPattern; redirect?: RouteDefinition['redirect']; handler?: RouteHandler };
type Prefix = Priority & { depth: number; compiled: CompiledPattern };
type State = { byName: Map<string, Route>; routes: Route[]; prefixes: Prefix[] };
type Mount = { routes: RegisteredRoute[]; parent?: string };

const ROOT: Node = { path: '', names: [], meta: {}, branch: [] };

function normalizePath(path: string) {
  return `/${ path.replace(/^\/+|\/+$/g, '') }`;
}

function joinPaths(parentPath: string, path: string) {
  if (path.startsWith('/')) {return normalizePath(path);}
  // A leading brace group can own its joining slash, including optional ones.
  const parent = parentPath === '/' ? '' : parentPath;
  return path.startsWith('{/') ? normalizePathname(`${ parent }${ path }`) : normalizePath(`${ parent }/${ path }`);
}

/* Route ordering: specificity first, then mount and definition order. */

function compareRanks(a: number[], b: number[]) {
  const shared = Math.min(a.length, b.length);
  for (let index = 0; index < shared; index++) {
    if (a[index] !== b[index]) {return b[index] - a[index];}
  }
  return a.length - b.length;
}

function comparePriority(a: Priority, b: Priority) {
  return compareRanks(a.ranks, b.ranks) || a.mount - b.mount;
}

/* Compilation */

function assertDefinition(definition: RouteDefinition) {
  if (!definition || typeof definition.path !== 'string') {
    throw new TypeError('A route definition requires a string "path"');
  }
}

function snapshotRoutes(routes: RouteTable, controller: object): RegisteredRoute[] {
  const array = Array.isArray(routes);
  const prototype = !array && routes && typeof routes === 'object' ? Object.getPrototypeOf(routes) : undefined;
  if (!array && prototype !== Object.prototype && prototype !== null) {throw new TypeError('mount() requires an array of route definitions or a route hash');}
  const definitions: readonly RouteDefinition[] = array ? routes : Object.entries(routes).map(([name, definition]) => ({ ...definition, name }));
  return definitions.map(definition => {
    assertDefinition(definition);
    const handler = definition.handler === undefined ? undefined : resolveMethod(controller, definition.handler, definition.name ?? definition.path).bind(controller) as RouteHandler;
    return { ...definition, handler, meta: { ...definition.meta }, children: definition.children && snapshotRoutes(definition.children, controller) };
  });
}

function registerRoute(definition: RegisteredRoute, node: Node, pattern: Pattern, state: State, mount: number) {
  const { name } = definition;
  if (typeof name !== 'string' || !name) {throw new TypeError(`Route name must be a non-empty string (path "${ node.path }")`);}
  if (state.byName.has(name)) {throw new Error(`Duplicate route name "${ name }"`);}
  const route = { ...node, name, pattern, compiled: pattern.compile(name), ranks: pattern.getRanks(), mount, redirect: definition.redirect, handler: definition.handler };
  state.byName.set(name, route);
  state.routes.push(route);
}

function compileNode(definition: RegisteredRoute, parent: Node, state: State, mount: number) {
  const path = joinPaths(parent.path, definition.path);
  const pattern = new Pattern(path, definition.name === undefined ? `"${ path }"` : `"${ definition.name }"`);
  const names = pattern.names;
  const ownNames = definition.path.startsWith('/') ? names : names.filter(item => !parent.names.includes(item));
  const repeated = ownNames.find(name => parent.branch.some(item => item.names.includes(name)));
  if (repeated !== undefined) {throw new Error(`Route "${ path }" repeats param "${ repeated }"; param names must be unique within a branch`);}
  const entry = {
    name: definition.name,
    path,
    names: ownNames,
    meta: { ...definition.meta },
  };
  const node = {
    path,
    names,
    meta: { ...parent.meta, ...definition.meta },
    branch: [...parent.branch, entry],
  };
  if (definition.name !== undefined) {registerRoute(definition, node, pattern, state, mount);} else {state.prefixes.push({ depth: node.branch.length, compiled: pattern.compilePrefix(), ranks: pattern.getRanks(), mount });}
  for (const child of definition.children ?? []) {compileNode(child, node, state, mount);}
}

function compileMount(mount: Mount & { index: number }, state: State) {
  const parent = mount.parent === undefined ? ROOT : state.byName.get(mount.parent)!;
  for (const definition of mount.routes) {compileNode(definition, parent, state, mount.index);}
}

// Mounts whose parent is not (or no longer) registered stay inactive until it returns.
function compile(mounts: Mount[]) {
  const state: State = { byName: new Map(), routes: [], prefixes: [] };
  let pending = mounts.map((mount, index) => ({ ...mount, index }));
  while (pending.length) {
    const ready = pending.filter(mount => mount.parent === undefined || state.byName.has(mount.parent));
    if (!ready.length) {break;}
    pending = pending.filter(mount => !ready.includes(mount));
    ready.forEach(mount => compileMount(mount, state));
  }
  // Stable sort preserves definition order after explicit specificity/mount ties.
  state.routes.sort(comparePriority);
  state.prefixes.sort((a, b) => b.depth - a.depth || comparePriority(a, b));
  return state;
}

/* Matching */

function pick(params: Record<string, string>, names: string[]) {
  return Object.fromEntries(names.filter(name => Object.hasOwn(params, name)).map(name => [name, params[name]]));
}

function toResult(route: Route, params: Record<string, string>, target: URL): MatcherResult {
  return {
    name: route.name,
    params,
    query: new URLSearchParams(target.search),
    url: target,
    meta: { ...route.meta },
    branch: route.branch.map(item => ({
      name: item.name,
      path: item.path,
      params: pick(params, item.names),
      meta: { ...item.meta },
    })),
    redirect: route.redirect,
    handler: route.handler,
  };
}

export class Matcher {
  #mounts: Mount[] = [];
  #state: State | null = null;
  #controller: object;

  constructor(routes: RouteTable = [], controller: object = {}) {
    this.#controller = controller;
    this.mount(routes);
  }

  #compiled() {
    this.#state ??= compile(this.#mounts);
    return this.#state;
  }

  #route(name: string) {
    const route = this.#compiled().byName.get(name);
    if (!route) {throw new Error(`Unknown route "${ name }"`);}
    return route;
  }

  #select(pathname: string) {
    for (const route of this.#compiled().routes) {
      let params = route.compiled.exec(pathname);
      // An omitted native optional pathname is empty; routing treats it as root.
      if (params === undefined && pathname === '/') {params = route.compiled.exec('');}
      if (params === undefined) {continue;}
      // A malformed percent-escape cannot be decoded, so the URL matches nothing.
      return params && { route, params };
    }
    return null;
  }

  match(url: URL) {
    const selected = this.#select(normalizePathname(url.pathname));
    return selected && toResult(selected.route, selected.params, url);
  }

  matchPrefix(url: URL) {
    const pathname = normalizePathname(url.pathname);
    for (const prefix of this.#compiled().prefixes) {
      const params = prefix.compiled.exec(pathname);
      if (params !== undefined) {return params ?? {};}
    }
    return {};
  }

  url(name: string, params: Params = {}, options: { query?: Query } = {}) {
    const route = this.#route(name);
    const path = canonicalPathname(route.pattern.build(params, route.name));
    // Matching and generation share one authority. A static sibling may shadow a
    // generated parameter value.
    const matched = this.#select(path);
    // Native pathname matching can preserve literal backslashes that HTTP URLs
    // reinterpret as separators (or a host). Keep rejecting those generated links.
    if (path.startsWith('//') || path.includes('\\') || matched?.route.name !== name || route.names.some(key => hasValue(params, key) && matched.params[key] !== String(params[key]))) {
      throw new Error(`Route "${ name }" params do not round trip through "${ path }"`);
    }
    const search = toSearchParams(options.query).toString();
    return search ? `${ path }?${ search }` : path;
  }

  getParamNames(name: string) {
    return [...this.#route(name).names];
  }

  has(name: string) {
    return this.#compiled().byName.has(name);
  }

  mount(routes: RouteTable, options: MountOptions = {}) {
    const { parent, controller = this.#controller } = options;
    const registered = snapshotRoutes(routes, controller);
    if (parent !== undefined && !this.has(parent)) {throw new Error(`Unknown parent route "${ parent }"`);}
    const mount = { routes: registered, parent };
    const previous = this.#state;
    this.#mounts.push(mount);
    this.#state = null;
    try {
      this.#compiled();
    } catch (error) {
      this.#mounts.pop();
      this.#state = previous;
      throw error;
    }
    return () => {
      const index = this.#mounts.indexOf(mount);
      if (index === -1) {return;}
      this.#mounts.splice(index, 1);
      this.#state = null;
    };
  }
}
