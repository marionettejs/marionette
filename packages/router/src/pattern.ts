import type { Params } from './types.ts';

type TextToken = { type: 'text'; value: string };
type ParamToken = { type: 'param'; name: string };
type GroupToken = { type: 'group'; tokens: Token[]; optional: boolean };
type Token = TextToken | ParamToken | GroupToken;
type ParseState = { path: string; pos: number };
type RankState = { ranks: number[]; current: number | null };

// Execution distinguishes an unmatched pathname (undefined) from a matched
// pathname whose parameters cannot be decoded (null). The table must not fall
// through to a lower-ranked route after a decoding failure.
export interface CompiledPattern {
  test(pathname: string): boolean;
  exec(pathname: string): Record<string, string> | null | undefined;
}

const TEXT_STOPS = ':(){}?*+';
const NAME = /[A-Za-z_$][\w$]*(?![\p{ID_Continue}$\u200C\u200D])/uy;

const STATIC = 3;
const PARAM = 2;
const OPTIONAL = 1;
const PATHNAME = new URLPattern({ pathname: '*' });

export function normalizePathname(pathname: string) {
  return pathname.replace(/\/+$/, '') || '/';
}

export function canonicalPathname(pathname: string) {
  return normalizePathname(PATHNAME.exec({ pathname })!.pathname.input);
}

/* Path tokenizer for the supported URLPattern pathname subset. */

function readNamed(state: ParseState): ParamToken {
  state.pos++;
  NAME.lastIndex = state.pos;
  const match = NAME.exec(state.path);
  if (!match) {throw new Error(`Expected an ASCII parameter name ([A-Za-z_$][A-Za-z0-9_$]*) after ":" in path "${ state.path }"`);}
  state.pos = NAME.lastIndex;
  return { type: 'param', name: match[0] };
}

function readGroup(state: ParseState): GroupToken {
  state.pos++;
  const tokens = readTokens(state, true);
  state.pos++;
  const optional = state.path[state.pos] === '?';
  if (optional) {state.pos++;}
  return { type: 'group', tokens, optional };
}

function readText(state: ParseState): TextToken {
  let value = '';
  while (state.pos < state.path.length && !TEXT_STOPS.includes(state.path[state.pos])) {
    if (state.path[state.pos] === '\\') {state.pos++;}
    const char = state.path[state.pos++];
    if (char === '?' || char === '#') {
      throw new Error(`Literal URL delimiter "${ char }" in path "${ state.path }"; use ${ char === '?' ? '%3F' : '%23' } instead`);
    }
    value += char ?? '';
  }
  return { type: 'text', value };
}

const READERS: Record<string, (state: ParseState) => Token> = { ':': readNamed, '{': readGroup };

function readTokens(state: ParseState, inGroup: boolean): Token[] {
  const tokens: Token[] = [];
  while (state.pos < state.path.length) {
    const char = state.path[state.pos];
    if (char === '}') {
      if (!inGroup) {throw new Error(`Unexpected "}" in path "${ state.path }"`);}
      return tokens;
    }
    if ('()*+?'.includes(char)) {
      throw new Error(`Unsupported syntax "${ char }" in path "${ state.path }"; use named parameters, brace groups and escapes`);
    }
    tokens.push((READERS[char] ?? readText)(state));
  }
  if (inGroup) {throw new Error(`Unterminated "{" in path "${ state.path }"`);}
  return tokens;
}

function tokenize(path: string) {
  return readTokens({ path, pos: 0 }, false);
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
      collectRanks(token.tokens, token.optional ? Math.min(cap, OPTIONAL) : cap, state);
    } else {
      addToSegment(state, Math.min(cap, PARAM));
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

// A dot segment would be resolved away by URL parsing and name another route.
function encodeSegment(token: ParamToken, routeName: string, segment: string) {
  if (segment === '.' || segment === '..') {
    throw new Error(`Route "${ routeName }" param "${ token.name }" cannot contain the dot segment "${ segment }"`);
  }
  return encodeURIComponent(segment);
}

function buildParam(token: ParamToken, params: Params, routeName: string) {
  if (!hasValue(params, token.name)) {
    throw new Error(`Route "${ routeName }" is missing param "${ token.name }"`);
  }
  return encodeSegment(token, routeName, String(params[token.name]));
}

function buildGroup(group: GroupToken, params: Params, routeName: string): string {
  if (group.optional && !paramNames(group.tokens).some(name => hasValue(params, name))) {return '';}
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
