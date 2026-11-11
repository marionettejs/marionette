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
  exec(pathname: string): Record<string, string> | null | undefined;
}

const TEXT_STOPS = ':(){}?*+';
const NAME = /[A-Za-z_$][\w$]*(?![\p{ID_Continue}$\u200C\u200D])/uy;

const STATIC = 4;
const MIXED = 3;
const PARAM = 2;
const OPTIONAL = 1;
let pathnamePattern: URLPattern;

export function normalizePathname(pathname: string) {
  return pathname.replace(/\/+$/, '') || '/';
}

export function canonicalPathname(pathname: string) {
  pathnamePattern ??= new URLPattern({ pathname: '*' });
  return normalizePathname(pathnamePattern.exec({ pathname })!.pathname.input);
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
  if (state.current === null || state.current === rank) {state.current = rank;} else if (state.current >= MIXED || rank === STATIC) {state.current = MIXED;} else {state.current = Math.max(state.current, rank);}
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
  return Object.hasOwn(params, name) && params[name] !== undefined && params[name] !== null && params[name] !== '';
}

function buildParam(token: ParamToken, params: Params, routeName: string) {
  if (!hasValue(params, token.name)) {
    throw new Error(`Route "${ routeName }" is missing param "${ token.name }"`);
  }
  return encodeURIComponent(String(params[token.name]));
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

function createPattern(path: string, name: string, declaredPath: string) {
  try {
    return new URLPattern({ pathname: path });
  } catch (error) {
    throw new Error(`Invalid path "${ declaredPath }" for route "${ name }": ${ (error as Error).message }`, { cause: error });
  }
}

function decodeParams(names: string[], groups: Record<string, string | undefined>) {
  try {
    return Object.fromEntries(names.filter(name => groups[name] !== undefined)
      .map(name => [name, decodeURIComponent(groups[name]!)]));
  } catch {
    // URLPattern groups are strings; native decoding fails only on malformed URI data.
    return null;
  }
}

function compilePattern(path: string, name: string, names: string[], declaredPath = path): CompiledPattern {
  const pattern = createPattern(path, name, declaredPath);
  return {
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

  compile(name: string) {
    return compilePattern(this.#path, name, this.names);
  }

  compilePrefix() {
    return compilePattern(`${ this.#path }{/*}?`, this.#path, this.names, this.#path);
  }

  build(params: Params, name: string) {
    return normalizePathname(buildTokens(this.#tokens, params, name));
  }
}
