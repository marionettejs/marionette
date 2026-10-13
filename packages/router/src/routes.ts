export type Definition = string | { readonly path: string; readonly aliases?: readonly string[]; readonly meta?: unknown };
export type Definitions = Record<string, Definition>;
type PathOf<D> = D extends string ? D : D extends { path: infer P extends string } ? P : never;
type ParamsIn<P extends string> = string extends P ? string : P extends `${string}/:${infer K}/${infer Rest}` ? K | ParamsIn<`/${Rest}`>
  : P extends `${string}/:${infer K}` ? K : never;
export type Query = string | URLSearchParams | Record<string, string> | Iterable<[string, string]>;
export type NamedTarget<D extends Definitions> = {
  [N in keyof D & string]: { name: N; search?: Query; hash?: string } &
    ([ParamsIn<PathOf<D[N]>>] extends [never] ? { params?: Record<string, never> }
      : { params: Record<ParamsIn<PathOf<D[N]>>, string | number> });
}[keyof D & string];
export type Match<D extends Definitions> = {
  [N in keyof D & string]: { readonly name: N; readonly params: Readonly<Record<ParamsIn<PathOf<D[N]>>, string>>;
    readonly alias: boolean; readonly meta: D[N] extends { meta: infer M } ? M : undefined };
}[keyof D & string];
export interface RouteTable<D extends Definitions> {
  href(target: NamedTarget<D>): string;
  match(url: string | URL): Match<D> | null;
}

type Segment = { name: string; literal?: never } | { literal: string; name?: never };
// Assessment prototype: exact path segments, explicit aliases, first match wins.
// No framework, rendering, global browser state, or URLPattern dependency.
const parameter = /^:([A-Za-z][A-Za-z0-9_]*)$/;

function compile(pattern: string): Segment[] {
  if (!pattern.startsWith('/') || /[?#*()]/.test(pattern)) {
    throw new TypeError(`Unsupported path pattern: ${pattern}`);
  }
  const names = new Set();
  return pattern.split('/').map(part => {
    const match = parameter.exec(part);
    if (!match) {
      if (['.', '..'].includes(part)) {throw new TypeError('Dot segments are not route literals');}
      return { literal: new URL(`https://router.invalid/${part}`).pathname.slice(1) };
    }
    if (names.has(match[1])) {throw new TypeError(`Duplicate parameter: ${match[1]}`);}
    names.add(match[1]);
    return { name: match[1] };
  });
}

function encode(value: string | number | undefined, name: string) {
  if (value == null || String(value) === '' || ['.', '..'].includes(String(value))) {
    throw new TypeError(`Missing or invalid parameter: ${name}`);
  }
  return encodeURIComponent(String(value));
}

export function createRoutes<const D extends Definitions>(definitions: D): RouteTable<D> {
  const routes = Object.entries(definitions).map(([name, value]) => {
    const definition: Exclude<Definition, string> = typeof value === 'string' ? { path: value } : value;
    const patterns = [definition.path, ...(definition.aliases ?? [])].map(compile);
    const params = (pattern: Segment[]) => pattern.filter(part => part.name).map(part => part.name).sort().join(',');
    if (patterns.some(pattern => params(pattern) !== params(patterns[0]))) {
      throw new TypeError(`Alias parameters must match canonical parameters: ${name}`);
    }
    return { name, definition, patterns };
  });
  return Object.freeze({
    href(target: NamedTarget<D>) {
      const { name, search, hash = '' } = target;
      const params = (target.params ?? {}) as Record<string, string | number>;
      const route = routes.find(candidate => candidate.name === name);
      if (!route) {throw new TypeError(`Unknown route name: ${name}`);}
      const path = route.patterns[0].map(part => part.name ?
        encode(params[part.name], part.name) : part.literal).join('/');
      const query = new URLSearchParams(search as ConstructorParameters<typeof URLSearchParams>[0]).toString();
      return path + (query ? `?${query}` : '') + (hash ? `#${encodeURIComponent(hash)}` : '');
    },
    match(input: string | URL) {
      const url = input instanceof URL ? input : new URL(input, 'https://router.invalid');
      // Decode each segment once; an encoded slash remains within its parameter.
      const raw = url.pathname.split('/');
      const decoded = raw.map(decodeURIComponent);
      for (const route of routes) {
        for (const [alias, pattern] of route.patterns.entries()) {
          if (pattern.length !== raw.length) {continue;}
          const params: Record<string, string> = {};
          if (!pattern.every((part, index) => {
            if (!part.name) {return part.literal === raw[index];}
            if (!raw[index]) {return false;}
            params[part.name] = decoded[index];
            return true;
          })) {continue;}
          return Object.freeze({ name: route.name, params: Object.freeze(params),
            meta: route.definition.meta, alias: alias !== 0 }) as Match<D>;
        }
      }
      return null;
    },
  });
}
