import { Pattern, normalizePathname, hasValue } from './pattern.ts';
import type { CompiledPattern } from './pattern.ts';
import type { AliasDefinition, Alias, BranchEntry, RouteDefinition, Params, Query, MatcherResult } from './types.ts';

type CompiledBranch = Omit<BranchEntry, 'params'> & { names: string[] };
type Node = { path: string; names: string[]; meta: Record<string, unknown>; branch: CompiledBranch[] };
type CompiledAlias = Omit<AliasDefinition, 'policy'> & { policy: 'canonicalize' | 'preserve'; pattern: Pattern };
type Route = Node & { name: string; pattern: Pattern; redirect?: RouteDefinition['redirect']; aliases: CompiledAlias[] };
type Entry = { route: Route; alias: CompiledAlias | null; pattern: CompiledPattern; ranks: number[]; mount: number; seq: number };
type State = { byName: Map<string, Route>; entries: Entry[]; aliases: Alias[]; prefixes: { depth: number; pattern: CompiledPattern }[] };
type Scope = { index: number; seq: number };
type Mount = { routes: RouteDefinition[]; parent?: string };

const BASE_URL = 'http://localhost';
const POLICIES = ['canonicalize', 'preserve'];
const ROOT: Node = { path: '', names: [], meta: {}, branch: [] };

function normalizePath(path: string) {
  return `/${ path.replace(/^\/+|\/+$/g, '') }`;
}

function joinPaths(parentPath: string, path: string) {
  return normalizePath(path.startsWith('/') ? path : `${ parentPath }/${ path }`);
}

function toURL(url: URL | string) {
  return url instanceof URL ? url : new URL(url, BASE_URL);
}

function toSearchParams(query?: Query) {
  if (query === undefined || query === null) {return new URLSearchParams();}
  if (typeof query === 'string' || query instanceof URLSearchParams) {return new URLSearchParams(query);}
  const entries = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => [key, String(value)]);
  return new URLSearchParams(entries);
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
  if (definition.name === undefined && definition.aliases?.length) {
    throw new Error(`Aliases require a named route (path "${ definition.path }")`);
  }
}

function assertAliasParams(path: string, name: string, names: string[], canonicalNames: string[]) {
  if (names.length === canonicalNames.length && names.every(item => canonicalNames.includes(item))) {return;}
  throw new Error(`Alias "${ path }" of route "${ name }" must declare exactly the params: ${ canonicalNames.join(', ') || '(none)' }`);
}

function compileAlias(alias: AliasDefinition, name: string, canonicalNames: string[]): CompiledAlias {
  if (typeof alias?.path !== 'string' || !alias.path.startsWith('/')) {
    throw new Error(`Alias of route "${ name }" requires an absolute path starting with "/"`);
  }
  const policy = alias.policy ?? 'canonicalize';
  if (!POLICIES.includes(policy)) {throw new Error(`Alias "${ alias.path }" of route "${ name }" has unknown policy "${ policy }"`);}
  const path = normalizePath(alias.path);
  const pattern = new Pattern(path, `alias "${ path }"`);
  assertAliasParams(path, name, pattern.names, canonicalNames);
  return { path, until: alias.until, policy, pattern };
}

function addEntry(state: State, scope: Scope, route: Route, alias: CompiledAlias | null, pattern: Pattern) {
  state.entries.push({
    route,
    alias,
    pattern: pattern.compile(route.name, route.names),
    ranks: pattern.getRanks(),
    mount: scope.index,
    seq: scope.seq++,
  });
}

function registerRoute(definition: RouteDefinition, node: Node, pattern: Pattern, state: State, scope: Scope) {
  const { name } = definition;
  if (typeof name !== 'string' || !name) {throw new TypeError(`Route name must be a non-empty string (path "${ node.path }")`);}
  if (state.byName.has(name)) {throw new Error(`Duplicate route name "${ name }"`);}
  const aliases = (definition.aliases ?? []).map(alias => compileAlias(alias, name, node.names));
  const route = { ...node, name, pattern, redirect: definition.redirect, aliases };
  state.byName.set(name, route);
  addEntry(state, scope, route, null, pattern);
  for (const alias of aliases) {
    addEntry(state, scope, route, alias, alias.pattern);
    state.aliases.push({ name, path: alias.path, until: alias.until, policy: alias.policy });
  }
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
  const state: State = { byName: new Map(), entries: [], aliases: [], prefixes: [] };
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
  const { route, alias } = entry;
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
    alias: alias ? alias.path : null,
    aliasPolicy: alias ? alias.policy : null,
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

  match(url: URL | string) {
    const target = toURL(url);
    const pathname = normalizePathname(target.pathname);
    for (const entry of this.#compiled().entries) {
      const params = entry.pattern.exec(pathname);
      if (params === undefined) {continue;}
      // A malformed percent-escape cannot be decoded, so the URL matches nothing.
      return params && toResult(entry, params, target);
    }
    return null;
  }

  matchPrefix(url: URL | string) {
    const pathname = normalizePathname(toURL(url).pathname);
    const containing = this.#compiled().prefixes
      .filter(prefix => prefix.pattern.test(pathname))
      .sort((a, b) => b.depth - a.depth)[0];
    if (!containing) {return {};}
    return containing.pattern.exec(pathname) ?? {};
  }

  url(name: string, params: Params = {}, options: { query?: Query } = {}) {
    const route = this.#route(name);
    const path = route.pattern.build(params, route.name);
    // Matching and generation share one authority. A static sibling may shadow a
    // generated parameter value, and normalization can remove repeated segments.
    const matched = this.match(path);
    if (matched?.name !== name || route.names.some(key => hasValue(params, key) && matched.params[key] !== String(params[key]))) {
      throw new Error(`Route "${ name }" params do not round trip through "${ path }"`);
    }
    const search = toSearchParams(options.query).toString();
    return search ? `${ path }?${ search }` : path;
  }

  getParamNames(name: string) {
    return [...this.#route(name).names];
  }

  getAliases() {
    return this.#compiled().aliases.map(alias => ({ ...alias }));
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
