import type { AliasDefinition, Alias, BranchEntry, RouteDefinition, Params, Query, MatcherResult } from './types.ts';

type TextToken = { type: 'text'; value: string };
type ParamToken = { type: 'param'; name: string; prefix: string; wildcard: boolean; regex?: string; modifier: string; pattern?: RegExp };
type GroupToken = { type: 'group'; tokens: Token[]; modifier: string };
type Token = TextToken | ParamToken | GroupToken;
type ParseState = { path: string; pos: number; unnamed: number };
type RankState = { ranks: number[]; current: number | null };
type CompiledBranch = Omit<BranchEntry, 'params'> & { names: string[] };
type Node = { path: string; names: string[]; meta: Record<string, unknown>; branch: CompiledBranch[] };
type CompiledAlias = Omit<AliasDefinition, 'policy'> & { policy: 'canonicalize' | 'preserve'; tokens: Token[] };
type Route = Node & { name: string; tokens: Token[]; redirect?: RouteDefinition['redirect']; aliases: CompiledAlias[] };
type Entry = { route: Route; alias: CompiledAlias | null; pattern: URLPattern; ranks: number[]; mount: number; seq: number };
type State = { byName: Map<string, Route>; entries: Entry[]; aliases: Alias[]; prefixes: { names: string[]; depth: number; pattern: URLPattern }[] };
type Scope = { index: number; seq: number };
type Mount = { routes: RouteDefinition[]; parent?: string };

const BASE_URL = 'http://localhost';
const POLICIES = ['canonicalize', 'preserve'];
const MODIFIERS = '?*+';
const TEXT_STOPS = ':(*{}';
const NAME = /[A-Za-z_$][\w$]*/y;

const STATIC = 3;
const PARAM = 2;
const OPTIONAL = 1;
const WILDCARD = 0;

const ROOT: Node = { path: '', names: [], meta: {}, branch: [] };

function normalizePath(path: string) {
  return `/${ path.replace(/^\/+|\/+$/g, '') }`;
}

function normalizePathname(pathname: string) {
  return pathname.replace(/\/+$/, '') || '/';
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

/* Path tokenizer: text | param | group, mirroring the URLPattern pathname syntax. */

function readModifier(state: ParseState) {
  const char = state.path[state.pos];
  if (!char || !MODIFIERS.includes(char)) {return '';}
  state.pos++;
  return char;
}

function skipRegex(state: ParseState) {
  let depth = 0;
  while (state.pos < state.path.length) {
    const char = state.path[state.pos++];
    if (char === '\\') {state.pos++;} else if (char === '(') {depth++;} else if (char === ')' && --depth === 0) {return;}
  }
  throw new Error(`Unterminated "(" in path "${ state.path }"`);
}

function readRegex(state: ParseState) {
  const start = state.pos + 1;
  skipRegex(state);
  return state.path.slice(start, state.pos - 1);
}

function paramToken(state: ParseState, name: string, wildcard: boolean): ParamToken {
  const regex = !wildcard && state.path[state.pos] === '(' ? readRegex(state) : undefined;
  return { type: 'param', name, prefix: '', wildcard, regex, modifier: readModifier(state) };
}

function readNamed(state: ParseState) {
  state.pos++;
  NAME.lastIndex = state.pos;
  const match = NAME.exec(state.path);
  if (!match) {throw new Error(`Expected a parameter name after ":" in path "${ state.path }"`);}
  state.pos = NAME.lastIndex;
  return paramToken(state, match[0], false);
}

function readUnnamed(state: ParseState) {
  return paramToken(state, String(state.unnamed++), false);
}

function readWildcard(state: ParseState) {
  state.pos++;
  return paramToken(state, String(state.unnamed++), true);
}

function readGroup(state: ParseState): GroupToken {
  state.pos++;
  const tokens = readTokens(state, true);
  state.pos++;
  return { type: 'group', tokens, modifier: readModifier(state) };
}

function readText(state: ParseState): TextToken {
  let value = '';
  while (state.pos < state.path.length && !TEXT_STOPS.includes(state.path[state.pos])) {
    if (state.path[state.pos] === '\\') {state.pos++;}
    value += state.path[state.pos++] ?? '';
  }
  return { type: 'text', value };
}

const READERS: Record<string, (state: ParseState) => Token> = { ':': readNamed, '(': readUnnamed, '*': readWildcard, '{': readGroup };

// A '/' directly before a param belongs to the param, so optional params drop it too.
function takePrefix(tokens: Token[], token: ParamToken) {
  const last = tokens.at(-1);
  if (last?.type !== 'text' || !last.value.endsWith('/')) {return;}
  last.value = last.value.slice(0, -1);
  token.prefix = '/';
  if (!last.value) {tokens.pop();}
}

function readTokens(state: ParseState, inGroup: boolean): Token[] {
  const tokens: Token[] = [];
  while (state.pos < state.path.length) {
    const char = state.path[state.pos];
    if (char === '}') {
      if (!inGroup) {throw new Error(`Unexpected "}" in path "${ state.path }"`);}
      return tokens;
    }
    const token = (READERS[char] ?? readText)(state);
    if (token.type === 'param') {takePrefix(tokens, token);}
    tokens.push(token);
  }
  if (inGroup) {throw new Error(`Unterminated "{" in path "${ state.path }"`);}
  return tokens;
}

function tokenize(path: string) {
  return readTokens({ path, pos: 0, unnamed: 0 }, false);
}

function paramNames(tokens: Token[]): string[] {
  return tokens.flatMap(token => {
    if (token.type === 'group') {return paramNames(token.tokens);}
    return token.type === 'param' ? [token.name] : [];
  });
}

function uniqueParamNames(tokens: Token[], label: string) {
  const names = paramNames(tokens);
  const duplicate = names.find((name, index) => names.indexOf(name) !== index);
  if (duplicate !== undefined) {throw new Error(`Route ${ label } repeats param "${ duplicate }"; param names must be unique within a branch`);}
  return names;
}

/* Ranking: one rank per path segment, compared left to right. */

function paramRank(token: ParamToken) {
  if (token.wildcard || token.modifier === '*' || token.modifier === '+') {return WILDCARD;}
  return token.modifier === '?' ? OPTIONAL : PARAM;
}

function groupCap(group: GroupToken, cap: number) {
  if (group.modifier === '?') {return Math.min(cap, OPTIONAL);}
  if (group.modifier === '*' || group.modifier === '+') {return WILDCARD;}
  return cap;
}

function closeSegment(state: RankState) {
  if (state.current !== null) {state.ranks.push(state.current);}
  state.current = null;
}

function addToSegment(state: RankState, rank: number) {
  state.current = Math.min(state.current ?? rank, rank);
}

function collectText(value: string, cap: number, state: RankState) {
  value.split('/').forEach((piece, index) => {
    if (index > 0) {closeSegment(state);}
    if (piece) {addToSegment(state, Math.min(cap, STATIC));}
  });
}

function collectRanks(tokens: Token[], cap: number, state: RankState) {
  for (const token of tokens) {
    if (token.type === 'text') {
      collectText(token.value, cap, state);
    } else if (token.type === 'group') {
      collectRanks(token.tokens, groupCap(token, cap), state);
    } else {
      if (token.prefix) {closeSegment(state);}
      addToSegment(state, Math.min(cap, paramRank(token)));
    }
  }
}

function segmentRanks(tokens: Token[]) {
  const state: RankState = { ranks: [], current: null };
  collectRanks(tokens, STATIC, state);
  closeSegment(state);
  return state.ranks;
}

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

/* URL building */

function hasValue(params: Params, name: string) {
  return params[name] !== undefined && params[name] !== null && params[name] !== '';
}

function isOptional(token: ParamToken) {
  return token.modifier === '?' || token.modifier === '*' || token.wildcard === true;
}

function isRepeated(token: ParamToken) {
  return token.wildcard || token.modifier === '*' || token.modifier === '+';
}

// URLPattern compiles regex groups in Unicode mode, so the build-time check does too.
// Route compilation has already rejected invalid regexes.
function paramPattern(token: ParamToken) {
  token.pattern ??= new RegExp(`^(?:${ token.regex })$`, 'u');
  return token.pattern;
}

// A dot segment would be resolved away by URL parsing and name another route.
function encodeSegment(token: ParamToken, route: Route, segment: string) {
  if (segment === '.' || segment === '..') {
    throw new Error(`Route "${ route.name }" param "${ token.name }" cannot contain the dot segment "${ segment }"`);
  }
  const encoded = encodeURIComponent(segment);
  if (token.regex !== undefined && !paramPattern(token).test(encoded)) {
    throw new Error(`Route "${ route.name }" param "${ token.name }" must match (${ token.regex }): "${ segment }"`);
  }
  return encoded;
}

function encodeValue(token: ParamToken, route: Route, value: string) {
  if (!isRepeated(token)) {return encodeSegment(token, route, value);}
  return value.split('/').map(segment => encodeSegment(token, route, segment)).join('/');
}

function buildParam(token: ParamToken, params: Params, route: Route) {
  if (!hasValue(params, token.name)) {
    if (isOptional(token)) {return '';}
    throw new Error(`Route "${ route.name }" is missing param "${ token.name }"`);
  }
  return token.prefix + encodeValue(token, route, String(params[token.name]));
}

function buildGroup(group: GroupToken, params: Params, route: Route): string {
  const optional = group.modifier === '?' || group.modifier === '*';
  if (optional && !paramNames(group.tokens).some(name => hasValue(params, name))) {return '';}
  return buildTokens(group.tokens, params, route);
}

function buildTokens(tokens: Token[], params: Params, route: Route): string {
  return tokens.map(token => {
    if (token.type === 'text') {return token.value;}
    if (token.type === 'group') {return buildGroup(token, params, route);}
    return buildParam(token, params, route);
  }).join('');
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

function createPattern(path: string, name: string) {
  try {
    return new URLPattern({ pathname: path });
  } catch (error) {
    throw new Error(`Invalid path "${ path }" for route "${ name }": ${ (error as Error).message }`, { cause: error });
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
  const tokens = tokenize(path);
  assertAliasParams(path, name, uniqueParamNames(tokens, `alias "${ path }"`), canonicalNames);
  return { path, until: alias.until, policy, tokens };
}

function addEntry(state: State, scope: Scope, route: Route, alias: CompiledAlias | null, tokens: Token[]) {
  const path = alias ? alias.path : route.path;
  state.entries.push({
    route,
    alias,
    pattern: createPattern(path, route.name),
    ranks: segmentRanks(tokens),
    mount: scope.index,
    seq: scope.seq++,
  });
}

function registerRoute(definition: RouteDefinition, node: Node, tokens: Token[], state: State, scope: Scope) {
  const { name } = definition;
  if (typeof name !== 'string' || !name) {throw new TypeError(`Route name must be a non-empty string (path "${ node.path }")`);}
  if (state.byName.has(name)) {throw new Error(`Duplicate route name "${ name }"`);}
  const aliases = (definition.aliases ?? []).map(alias => compileAlias(alias, name, node.names));
  const route = { ...node, name, tokens, redirect: definition.redirect, aliases };
  state.byName.set(name, route);
  addEntry(state, scope, route, null, tokens);
  for (const alias of aliases) {
    addEntry(state, scope, route, alias, alias.tokens);
    state.aliases.push({ name, path: alias.path, until: alias.until, policy: alias.policy });
  }
}

function compileNode(definition: RouteDefinition, parent: Node, state: State, scope: Scope) {
  assertDefinition(definition);
  const path = joinPaths(parent.path, definition.path);
  const tokens = tokenize(path);
  const names = uniqueParamNames(tokens, definition.name === undefined ? `"${ path }"` : `"${ definition.name }"`);
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
  if (definition.name !== undefined) {registerRoute(definition, node, tokens, state, scope);} else {state.prefixes.push({ names, depth: node.branch.length, pattern: createPattern(`${ path }{/*}?`, path) });}
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

function decodeParams(names: string[], groups: Record<string, string | undefined>) {
  const params: Record<string, string> = {};
  try {
    for (const name of names) {
      if (groups[name] !== undefined) {params[name] = decodeURIComponent(groups[name]!);}
    }
  } catch {
    // URLPattern groups are strings; native decoding fails only on malformed URI data.
    return null;
  }
  return params;
}

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
      const groups = entry.pattern.exec({ pathname })?.pathname.groups;
      if (!groups) {continue;}
      // A malformed percent-escape cannot be decoded, so the URL matches nothing.
      const params = decodeParams(entry.route.names, groups);
      return params && toResult(entry, params, target);
    }
    return null;
  }

  matchPrefix(url: URL | string) {
    const pathname = normalizePathname(toURL(url).pathname);
    const containing = this.#compiled().prefixes
      .filter(prefix => prefix.pattern.test({ pathname }))
      .sort((a, b) => b.depth - a.depth)[0];
    if (!containing) {return {};}
    return decodeParams(containing.names, containing.pattern.exec({ pathname })!.pathname.groups) ?? {};
  }

  url(name: string, params: Params = {}, options: { query?: Query } = {}) {
    const route = this.#route(name);
    const path = normalizePathname(buildTokens(route.tokens, params, route));
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
