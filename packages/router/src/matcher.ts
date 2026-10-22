import { Pattern, normalizePathname, canonicalPathname, hasValue } from './pattern.ts';
import { toSearchParams } from './query.ts';
import type { CompiledPattern } from './pattern.ts';
import type { BranchEntry, RouteDefinition, Params, Query, MatcherResult } from './types.ts';

type CompiledBranch = Omit<BranchEntry, 'params'> & { names: string[] };
type Node = { path: string; names: string[]; meta: Record<string, unknown>; branch: CompiledBranch[] };
type Route = Node & { name: string; pattern: Pattern; redirect?: RouteDefinition['redirect'] };
type Entry = { route: Route; pattern: CompiledPattern; ranks: number[]; mount: number; seq: number };
type State = { byName: Map<string, Route>; entries: Entry[]; prefixes: { depth: number; pattern: CompiledPattern }[] };
type Scope = { index: number; seq: number };
type Mount = { routes: RouteDefinition[]; parent?: string };

const ROOT: Node = { path: '', names: [], meta: {}, branch: [] };

function normalizePath(path: string) {
  return `/${ path.replace(/^\/+|\/+$/g, '') }`;
}

function joinPaths(parentPath: string, path: string) {
  return normalizePath(path.startsWith('/') ? path : `${ parentPath }/${ path }`);
}

/* Route ordering: specificity first, then mount and definition order. */

function compareRanks(a: number[], b: number[]) {
  const shared = Math.min(a.length, b.length);
  for (let index = 0; index < shared; index++) {
    if (a[index] !== b[index]) {return b[index] - a[index];}
  }
  return a.length - b.length;
}

function compareEntries(a: Entry, b: Entry) {
  return compareRanks(a.ranks, b.ranks) || a.mount - b.mount || a.seq - b.seq;
}

/* Compilation */

function assertDefinition(definition: RouteDefinition) {
  if (!definition || typeof definition.path !== 'string') {
    throw new TypeError('A route definition requires a string "path"');
  }
}

function addEntry(state: State, scope: Scope, route: Route) {
  state.entries.push({
    route,
    pattern: route.pattern.compile(route.name),
    ranks: route.pattern.getRanks(),
    mount: scope.index,
    seq: scope.seq++,
  });
}

function registerRoute(definition: RouteDefinition, node: Node, pattern: Pattern, state: State, scope: Scope) {
  const { name } = definition;
  if (typeof name !== 'string' || !name) {throw new TypeError(`Route name must be a non-empty string (path "${ node.path }")`);}
  if (state.byName.has(name)) {throw new Error(`Duplicate route name "${ name }"`);}
  const route = { ...node, name, pattern, redirect: definition.redirect };
  state.byName.set(name, route);
  addEntry(state, scope, route);
}

function compileNode(definition: RouteDefinition, parent: Node, state: State, scope: Scope) {
  assertDefinition(definition);
  const path = joinPaths(parent.path, definition.path);
  const pattern = new Pattern(path, definition.name === undefined ? `"${ path }"` : `"${ definition.name }"`);
  const names = pattern.names;
  const entry = {
    name: definition.name,
    path,
    names: names.filter(item => !parent.names.includes(item)),
    meta: { ...definition.meta },
  };
  const node = {
    path,
    names,
    meta: { ...parent.meta, ...definition.meta },
    branch: [...parent.branch, entry],
  };
  if (definition.name !== undefined) {registerRoute(definition, node, pattern, state, scope);} else {state.prefixes.push({ depth: node.branch.length, pattern: pattern.compilePrefix() });}
  for (const child of definition.children ?? []) {compileNode(child, node, state, scope);}
}

function compileMount(mount: Mount & { index: number }, state: State) {
  const parent = mount.parent === undefined ? ROOT : state.byName.get(mount.parent)!;
  const scope = { index: mount.index, seq: 0 };
  for (const definition of mount.routes) {compileNode(definition, parent, state, scope);}
}

// Mounts whose parent is not (or no longer) registered stay inactive until it returns.
function compile(mounts: Mount[]) {
  const state: State = { byName: new Map(), entries: [], prefixes: [] };
  let pending = mounts.map((mount, index) => ({ ...mount, index }));
  while (pending.length) {
    const ready = pending.filter(mount => mount.parent === undefined || state.byName.has(mount.parent));
    if (!ready.length) {break;}
    pending = pending.filter(mount => !ready.includes(mount));
    ready.forEach(mount => compileMount(mount, state));
  }
  state.entries.sort(compareEntries);
  return state;
}

/* Matching */

function pick(params: Record<string, string>, names: string[]) {
  return Object.fromEntries(names.filter(name => name in params).map(name => [name, params[name]]));
}

function toResult(entry: Entry, params: Record<string, string>, target: URL): MatcherResult {
  const { route } = entry;
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
  };
}

export class Matcher {
  #mounts: Mount[] = [];
  #state: State | null = null;

  constructor(routes: RouteDefinition[] = []) {
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
    for (const entry of this.#compiled().entries) {
      const params = entry.pattern.exec(pathname);
      if (params === undefined) {continue;}
      // A malformed percent-escape cannot be decoded, so the URL matches nothing.
      return params && { entry, params };
    }
    return null;
  }

  match(url: URL) {
    const selected = this.#select(normalizePathname(url.pathname));
    return selected && toResult(selected.entry, selected.params, url);
  }

  matchPrefix(url: URL) {
    const pathname = normalizePathname(url.pathname);
    const containing = this.#compiled().prefixes
      .filter(prefix => prefix.pattern.test(pathname))
      .sort((a, b) => b.depth - a.depth)[0];
    if (!containing) {return {};}
    return containing.pattern.exec(pathname) ?? {};
  }

  url(name: string, params: Params = {}, options: { query?: Query } = {}) {
    const route = this.#route(name);
    const path = canonicalPathname(route.pattern.build(params, route.name));
    // Matching and generation share one authority. A static sibling may shadow a
    // generated parameter value.
    const matched = this.#select(path);
    // Native pathname matching can preserve literal backslashes that HTTP URLs
    // reinterpret as separators (or a host). Keep rejecting those generated links.
    if (path.startsWith('//') || path.includes('\\') || matched?.entry.route.name !== name || route.names.some(key => hasValue(params, key) && matched.params[key] !== String(params[key]))) {
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

  mount(routes: RouteDefinition[], options: { parent?: string } = {}) {
    const { parent } = options;
    if (!Array.isArray(routes)) {throw new TypeError('mount() requires an array of route definitions');}
    if (parent !== undefined && !this.has(parent)) {throw new Error(`Unknown parent route "${ parent }"`);}
    const mount = { routes, parent };
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
