import type { Params, RouteTable } from './types.ts';

// Preserve the literal table's type and identity without copying or freezing it.
export function defineRoutes<const R extends RouteTable>(routes: R): R {
  return routes;
}

type Characters<S extends string> = S extends `${ infer Head }${ infer Tail }` ? Head | Characters<Tail> : never;
type Letter = Characters<'abcdefghijklmnopqrstuvwxyz'>;
type NameCharacter = Letter | Uppercase<Letter> | Characters<'0123456789_$'>;
type Capture = { name: string; optional: boolean };

type ReadName<S extends string, Name extends string = ''> = S extends `${ infer Head }${ infer Tail }`
  ? Head extends NameCharacter ? ReadName<Tail, `${ Name }${ Head }`> : [Name, S]
  : [Name, ''];

// Native URLPattern rejects nested groups. Escapes still matter when finding a
// group's closing brace; this does not validate or expand the runtime grammar.
type ReadGroup<S extends string, Body extends string = ''> = S extends `\\${ infer Escaped }${ infer Tail }`
  ? ReadGroup<Tail, `${ Body }\\${ Escaped }`>
  : S extends `}${ infer Tail }` ? [Body, Tail]
    : S extends `${ infer Head }${ infer Tail }` ? ReadGroup<Tail, `${ Body }${ Head }`> : [Body, ''];

type GroupCaptures<S extends string, Optional extends boolean> = ReadGroup<S> extends [infer Body extends string, infer Tail extends string]
  ? Tail extends `?${ infer Rest }` ? PathCaptures<Body, true> | PathCaptures<Rest, Optional>
    : PathCaptures<Body, Optional> | PathCaptures<Tail, Optional>
  : never;

type NamedCapture<S extends string, Optional extends boolean> = ReadName<S> extends [infer Name extends string, infer Tail extends string]
  ? { name: Name; optional: Optional } | PathCaptures<Tail, Optional>
  : never;

type PathCaptures<S extends string, Optional extends boolean = false> = S extends `\\${ string }${ infer Tail }`
  ? PathCaptures<Tail, Optional>
  : S extends `{${ infer Tail }` ? GroupCaptures<Tail, Optional>
    : S extends `:${ infer Tail }` ? NamedCapture<Tail, Optional>
      : S extends `${ string }${ infer Tail }` ? PathCaptures<Tail, Optional> : never;

type CapturedNames<C, Optional extends boolean> = C extends { name: infer Name extends string; optional: Optional } ? Name : never;
type Simplify<T> = { [Key in keyof T]: T[Key] };
type CapturedParams<C extends Capture> = [C] extends [never] ? Record<string, never> : Simplify<
  { [Name in CapturedNames<C, false>]: string | number } &
  { [Name in Exclude<CapturedNames<C, true>, CapturedNames<C, false>>]?: string | number | null | undefined }
>;
type PathParams<Path extends string> = string extends Path ? Params : CapturedParams<PathCaptures<Path>>;

type JoinPath<Parent extends string, Path extends string> = Path extends `/${ string }` ? Path
  : string extends Parent | Path ? string : `${ Parent }/${ Path }`;
type RouteSpec = { name: string; path: string };

type NodeSpecs<Node, Parent extends string> = Node extends { path: infer Path extends string }
  ? (Node extends { name?: infer Name } ? [Extract<Name, string>] extends [never] ? never
    : { name: Extract<Name, string>; path: JoinPath<Parent, Path> } : never) |
    (Node extends { children: infer Children extends RouteTable } ? TableSpecs<Children, JoinPath<Parent, Path>> : never)
  : never;

type TableSpecs<R extends RouteTable, Parent extends string = ''> = R extends readonly (infer Node)[]
  ? number extends R['length'] ? RouteSpec : NodeSpecs<Node, Parent>
  : string extends keyof R ? RouteSpec
    : { [Name in keyof R & string]: NodeSpecs<Omit<R[Name], 'name'> & { name: Name }, Parent> }[keyof R & string];

/** Names from arrays, route hashes and their literal children; dynamic tables use string. */
export type RouteNames<R extends RouteTable> = TableSpecs<R>['name'];

type NamedPath<R extends RouteTable, Name extends string> = TableSpecs<R> extends infer Spec
  ? Spec extends { name: infer DeclaredName extends string; path: infer Path extends string }
    ? Name extends DeclaredName ? Path : never : never
  : never;

/** Input parameters only. Group correlations and mounted-route availability remain runtime checks. */
export type RouteParams<R extends RouteTable, Name extends RouteNames<R>> = string extends RouteNames<R>
  ? Params : Name extends string ? PathParams<NamedPath<R, Name>> : never;

/** A tuple union keeps each literal name paired with its required parameters. */
export type NamedRouteArgs<R extends RouteTable, Options> = string extends RouteNames<R>
  ? [name: string, params?: Params, options?: Options]
  : { [Name in RouteNames<R>]: {} extends RouteParams<R, Name>
    ? [name: Name, params?: RouteParams<R, Name>, options?: Options]
    : [name: Name, params: RouteParams<R, Name>, options?: Options]
  }[RouteNames<R>];
