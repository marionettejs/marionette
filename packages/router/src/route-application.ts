import { Application } from 'marionette';
import type { ApplicationConstructor, ApplicationInstance, ApplicationOptions, RegionInstance, ViewInstance } from 'marionette';
import { resolveMethod } from '@mnjs/utils';
import type { Merge } from '@mnjs/utils';
import type { RouterInstance } from './router.ts';
import type { ActiveMatch, Redirect, RouteDefinition, RouteHandler } from './types.ts';
import { clearSelection, currentApp, initSelection, switchTo } from './selection.ts';
import type { SwitchOptions } from './selection.ts';

export type ApplicationRouteLeaf = { name: string; handler?: string | RouteHandler; redirect?: Redirect; meta?: Record<string, unknown>; mount?: never; namespace?: never; region?: never };
export type ApplicationRouteMount = { mount: string; namespace?: string; region?: string; meta?: Record<string, unknown>; name?: never; handler?: never; redirect?: never };
export type ApplicationRouteDefinition = (ApplicationRouteLeaf | ApplicationRouteMount) & { path: string };
export type ApplicationRoutes = readonly ApplicationRouteDefinition[] | Record<string, ApplicationRouteLeaf | ApplicationRouteMount>;
export interface RouteApplicationOptions extends ApplicationOptions {
  [option: string]: unknown;
  onCleanupError?: (this: RouteApplicationInstance, error: unknown, app: ApplicationInstance<object, unknown>) => void;
}
export interface ApplicationRouteErrorContext { mount: string | undefined; phase: 'start' | 'route' }
interface Methods {
  routes: ApplicationRoutes;
  mountRoutes(router: RouterInstance, options?: { parent?: string }): () => void;
  routeTo(match: ActiveMatch): Promise<unknown>;
  routeBranch(match: ActiveMatch, index: number): Promise<unknown>;
  onBeforeRoute?(match: ActiveMatch): unknown;
  clearMountedChild(): void;
  childRouteOptions(match: ActiveMatch, mount: string): Record<string, unknown>;
  getMountRegion(region?: string): RegionInstance | undefined;
  handleRouteError(error: unknown, match: ActiveMatch, context: ApplicationRouteErrorContext): unknown;
  switchTo(appName: string, selection?: SwitchOptions): Promise<ApplicationInstance<object, unknown> | undefined>;
  clear(): boolean;
  getCurrent(): ApplicationInstance<object, unknown> | null;
}
export type RouteApplicationInstance = ApplicationInstance<object, unknown> & Methods;
type ArgumentsFor<Props, Previous extends unknown[]> = Props extends { constructor: (...args: infer Args) => unknown } ? Args
  : Props extends { initialize: (...args: infer Args) => unknown } ? Args : Previous;
type CreatedState<Props> = Props extends { createState: (...args: never[]) => infer State } ? State : object;
type StateFor<Props> = 'state' extends keyof Props
  ? Exclude<Props['state'], undefined> | (undefined extends Props['state'] ? CreatedState<Props> : never) : CreatedState<Props>;
type DeclaredFields<Added, Routes, Children> = Omit<Added, 'routes' | 'childApps'> &
  ([Routes] extends [never] ? Pick<Added, Extract<keyof Added, 'routes'>> : { routes: Routes }) &
  ([Children] extends [never] ? Pick<Added, Extract<keyof Added, 'childApps'>> : { childApps: Children });
type FeatureInstance<Props extends object, Args extends unknown[], State, Statics extends object> =
  InstanceType<ApplicationConstructor<Props, Args, State, Statics>>;
type FeatureConstructor<Props extends object, Args extends unknown[], State = object, Statics extends object = {}> =
  Omit<ApplicationConstructor<Props, Args, State, Statics>, 'extend'> & {
    new <Provided extends Args = Args>(...args: Provided): FeatureInstance<Props, Provided, State, Statics>;
    (this: object, ...args: Args): void;
    extend<Added extends object = {}, const Routes extends ApplicationRoutes = never,
      const Children extends ApplicationOptions['childApps'] = never, AddedStatics extends object = {}>(
      this: Added extends { constructor: (...args: never[]) => unknown } ? object : (this: object, ...args: never[]) => unknown,
      prototypeProperties?: Added & { routes?: Routes; childApps?: Children } &
        ThisType<FeatureInstance<Merge<Props, DeclaredFields<Added, Routes, Children>>,
          ArgumentsFor<Merge<Props, DeclaredFields<Added, Routes, Children>>, Args>, StateFor<Merge<Props, DeclaredFields<Added, Routes, Children>>>, Merge<Statics, AddedStatics>>>,
      staticProperties?: AddedStatics & ThisType<FeatureConstructor<Merge<Props, DeclaredFields<Added, Routes, Children>>,
        ArgumentsFor<Merge<Props, DeclaredFields<Added, Routes, Children>>, Args>, StateFor<Merge<Props, DeclaredFields<Added, Routes, Children>>>, Merge<Statics, AddedStatics>>>
    ): FeatureConstructor<Merge<Props, DeclaredFields<Added, Routes, Children>>,
      ArgumentsFor<Merge<Props, DeclaredFields<Added, Routes, Children>>, Args>, StateFor<Merge<Props, DeclaredFields<Added, Routes, Children>>>, Merge<Statics, AddedStatics>>;
  };
export type RouteApplicationConstructor = FeatureConstructor<Methods, [options?: RouteApplicationOptions]>;
type Declaration = { routes?: ApplicationRoutes; childApps?: ApplicationOptions['childApps'] };
type Source = Declaration | (abstract new (...args: never[]) => Declaration);
type DeclarationOf<S> = S extends { prototype: infer D } ? D : S;
type RoutesOf<S> = DeclarationOf<S> extends { routes: infer R extends ApplicationRoutes } ? R : {};
type ChildrenOf<S> = DeclarationOf<S> extends { childApps: infer C } ? C : {};
type Namespaced<A extends string, B extends string> = string extends A | B ? string : A extends '' ? B : B extends '' ? A : `${ A }:${ B }`;
type NamespaceOf<N> = N extends { namespace: infer S extends string } ? S : '';
type DeclaredNodes<R extends ApplicationRoutes> = R extends readonly (infer N)[] ? N
  : { [Path in keyof R & (string | number)]: R[Path] & { path: `${ Path }` } }[keyof R & (string | number)];
type CompiledNode<N, Children, Namespace extends string> = N extends { path: infer Path extends string }
  ? N extends { mount: infer Mount extends string }
    ? string extends keyof Children ? RouteDefinition : Mount extends keyof Children
      ? { path: Path; data: unknown; meta?: Record<string, unknown>; children: CompiledApplicationRoutes<Children[Mount], Namespaced<Namespace, NamespaceOf<N>>> }
      : never
    : N extends { name: infer Name extends string }
      ? Omit<RouteDefinition, 'path' | 'name' | 'children' | 'handler'> & { path: Path; name: Namespaced<Namespace, Name>; handler: 'routeTo'; data: unknown }
      : never
  : never;
export type CompiledApplicationRoutes<S, Namespace extends string = ''> = readonly (
  ApplicationRoutes extends RoutesOf<S> ? RouteDefinition : string extends keyof RoutesOf<S> ? RouteDefinition
    : CompiledNode<DeclaredNodes<RoutesOf<S>>, ChildrenOf<S>, Namespace>
)[];
const joinName = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(':');

// Each compilation owns its branch nodes, independently of other data users.
class RouteStep {
  constructor(readonly table: object, readonly handler?: string | RouteHandler, readonly mount?: string, readonly region?: string) {}
}

function definitionsOf(routes: ApplicationRoutes): readonly ApplicationRouteDefinition[] {
  return Array.isArray(routes) ? routes : Object.entries(routes).map(([path, definition]) => ({ ...definition, path }));
}

function mountedApplication(childApps: Declaration['childApps'], mount: string, path: string) {
  const Child = typeof childApps === 'function' ? undefined : childApps?.[mount];
  if (!(Child?.prototype instanceof RouteApplication)) {
    throw new TypeError(`Route "${ path }" mounts "${ mount }", which must be a RouteApplication class in a childApps object`);
  }
  return Child;
}

function compileTable(source: Source, namespace: string, table: object): RouteDefinition[] {
  const declaration = typeof source === 'function' ? source.prototype as Declaration : source as Declaration;
  const { routes = {}, childApps } = declaration;
  return definitionsOf(routes).map(definition => {
    const { path, mount, region, name, handler, redirect, meta } = definition;
    if (mount !== undefined) {
      const Child = mountedApplication(childApps, mount, path);
      return { path, meta, data: new RouteStep(table, undefined, mount, region), children: compileTable(Child, joinName(namespace, definition.namespace), table) };
    }
    if (typeof name !== 'string' || !name) {throw new TypeError(`Route "${ path }" requires a name`);}
    return { path, name: joinName(namespace, name), meta, redirect, handler: 'routeTo', data: new RouteStep(table, handler) };
  });
}

export function routeTable<const S extends Source, const Namespace extends string = ''>(source: S, { namespace = '' as Namespace }: { namespace?: Namespace } = {}): CompiledApplicationRoutes<S, Namespace> {
  return compileTable(source, namespace, {}) as unknown as CompiledApplicationRoutes<S, Namespace>;
}

function firstStepIndex(match: ActiveMatch) {
  const leaf = match.branch.at(-1)?.data;
  if (!(leaf instanceof RouteStep)) {throw new Error(`Route "${ match.name }" was not compiled by routeTable()`);}
  return match.branch.findIndex(entry => entry.data instanceof RouteStep && entry.data.table === leaf.table);
}

function constructRouteApplication(this: RouteApplicationInstance, options?: RouteApplicationOptions) {
  initSelection(this);
  Application.call(this, options);
}

export const RouteApplication = /* @__PURE__ */ Application.extend({
  constructor: constructRouteApplication,
  routes: {},

  mountRoutes(this: RouteApplicationInstance, router: RouterInstance, { parent }: { parent?: string } = {}) {
    return router.mount(routeTable(this), { parent, controller: this, owner: this });
  },

  switchTo(this: RouteApplicationInstance, appName: string, selection?: SwitchOptions) {
    return switchTo(this, appName, selection);
  },

  clear(this: RouteApplicationInstance) {return clearSelection(this);},
  getCurrent(this: RouteApplicationInstance) {return currentApp(this);},

  routeTo(this: RouteApplicationInstance, match: ActiveMatch) {
    return this.routeBranch(match, firstStepIndex(match));
  },

  async routeBranch(this: RouteApplicationInstance, match: ActiveMatch, index: number): Promise<unknown> {
    const { signal } = match;
    const entry = match.branch[index];
    const { handler, mount, region } = entry.data as RouteStep;
    let phase: ApplicationRouteErrorContext['phase'] = 'route';
    try {
      if (signal.aborted) {return;}
      this.triggerMethod('before:route', match);
      if (signal.aborted) {return;}
      if (mount === undefined) {
        this.clearMountedChild();
        if (signal.aborted || handler === undefined) {return;}
        return await (resolveMethod(this, handler, match.name) as RouteHandler).call(this, match, { signal });
      }
      phase = 'start';
      const child = await this.switchTo(mount, {
        key: entry.params, signal,
        options: { ...entry.params, ...this.childRouteOptions(match, mount), region: this.getMountRegion(region) },
      }) as RouteApplicationInstance | undefined;
      phase = 'route';
      if (!child) {return;}
      return await child.routeBranch(match, index + 1);
    } catch (error) {
      if (signal.aborted) {return;}
      return this.handleRouteError(error, match, { mount, phase });
    }
  },

  clearMountedChild(this: RouteApplicationInstance) {
    const current = this.getCurrent();
    if (current && definitionsOf(this.routes).some(({ mount }) => mount !== undefined && this.getChildApp(mount) === current)) {this.clear();}
  },

  childRouteOptions() {return {};},

  getMountRegion(this: RouteApplicationInstance, region?: string) {
    return region === undefined ? this.getRegion() : (this.getView() as ViewInstance).getRegion(region);
  },

  handleRouteError(error: unknown) {throw error;},
}) as unknown as RouteApplicationConstructor;
