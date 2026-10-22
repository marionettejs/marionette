import type { Params } from './types.ts';

type TextToken = { type: 'text'; value: string };
type ParamToken = { type: 'param'; name: string; prefix: string; wildcard: boolean; regex?: string; modifier: string; pattern?: RegExp };
type GroupToken = { type: 'group'; tokens: Token[]; modifier: string };
type Token = TextToken | ParamToken | GroupToken;
type ParseState = { path: string; pos: number; unnamed: number };
type RankState = { ranks: number[]; current: number | null };

// Execution distinguishes an unmatched pathname (undefined) from a matched
// pathname whose parameters cannot be decoded (null). The table must not fall
// through to a lower-ranked route after a decoding failure.
export interface CompiledPattern {
  test(pathname: string): boolean;
  exec(pathname: string): Record<string, string> | null | undefined;
}

const MODIFIERS = '?*+';
const TEXT_STOPS = ':(*{}';
const NAME = /[A-Za-z_$][\w$]*/y;

const STATIC = 3;
const PARAM = 2;
const OPTIONAL = 1;
const WILDCARD = 0;

export function normalizePathname(pathname: string) {
  return pathname.replace(/\/+$/, '') || '/';
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

/* URL building */

export function hasValue(params: Params, name: string) {
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
function encodeSegment(token: ParamToken, routeName: string, segment: string) {
  if (segment === '.' || segment === '..') {
    throw new Error(`Route "${ routeName }" param "${ token.name }" cannot contain the dot segment "${ segment }"`);
  }
  const encoded = encodeURIComponent(segment);
  if (token.regex !== undefined && !paramPattern(token).test(encoded)) {
    throw new Error(`Route "${ routeName }" param "${ token.name }" must match (${ token.regex }): "${ segment }"`);
  }
  return encoded;
}

function encodeValue(token: ParamToken, routeName: string, value: string) {
  if (!isRepeated(token)) {return encodeSegment(token, routeName, value);}
  return value.split('/').map(segment => encodeSegment(token, routeName, segment)).join('/');
}

function buildParam(token: ParamToken, params: Params, routeName: string) {
  if (!hasValue(params, token.name)) {
    if (isOptional(token)) {return '';}
    throw new Error(`Route "${ routeName }" is missing param "${ token.name }"`);
  }
  return token.prefix + encodeValue(token, routeName, String(params[token.name]));
}

function buildGroup(group: GroupToken, params: Params, routeName: string): string {
  const optional = group.modifier === '?' || group.modifier === '*';
  if (optional && !paramNames(group.tokens).some(name => hasValue(params, name))) {return '';}
  return buildTokens(group.tokens, params, routeName);
}

function buildTokens(tokens: Token[], params: Params, routeName: string): string {
  return tokens.map(token => {
    if (token.type === 'text') {return token.value;}
    if (token.type === 'group') {return buildGroup(token, params, routeName);}
    return buildParam(token, params, routeName);
  }).join('');
}

function createPattern(path: string, name: string) {
  try {
    return new URLPattern({ pathname: path });
  } catch (error) {
    throw new Error(`Invalid path "${ path }" for route "${ name }": ${ (error as Error).message }`, { cause: error });
  }
}

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

function compilePattern(path: string, name: string, names: string[]): CompiledPattern {
  const pattern = createPattern(path, name);
  return {
    test: pathname => pattern.test({ pathname }),
    exec(pathname) {
      const groups = pattern.exec({ pathname })?.pathname.groups;
      return groups ? decodeParams(names, groups) : undefined;
    },
  };
}

// One pathname grammar; route registration and candidate ordering stay in Matcher.
// Native compilation is explicit so route-table validation keeps its error order.
export class Pattern {
  #path: string;
  #tokens: Token[];
  readonly names: string[];

  constructor(path: string, label: string) {
    this.#path = path;
    this.#tokens = tokenize(path);
    this.names = uniqueParamNames(this.#tokens, label);
  }

  getRanks() {
    return segmentRanks(this.#tokens);
  }

  compile(name: string, names: string[]) {
    // Alias captures are decoded in canonical parameter order.
    return compilePattern(this.#path, name, names);
  }

  compilePrefix() {
    return compilePattern(`${ this.#path }{/*}?`, this.#path, this.names);
  }

  build(params: Params, name: string) {
    return normalizePathname(buildTokens(this.#tokens, params, name));
  }
}
