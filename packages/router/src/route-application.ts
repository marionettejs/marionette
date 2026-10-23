import { Application } from 'marionette';
import type { ApplicationConstructor, ApplicationInstance, ApplicationOptions } from 'marionette';
import type { Merge } from '@mnjs/utils';
import type { RouterInstance } from './router.ts';
import type { RouteTable } from './types.ts';

export interface RouteApplicationOptions extends ApplicationOptions {
  router: RouterInstance;
  routeParent?: string;
  routes?: RouteTable | ((this: RouteApplicationInstance) => RouteTable);
}
export type RouteApplicationInstance = Omit<ApplicationInstance<RouteApplicationOptions, unknown>, 'routes'> & {
  routes: NonNullable<RouteApplicationOptions['routes']>;
};
type RouteProperties = Pick<RouteApplicationInstance, 'routes'>;
export type ConfiguredRouteApplicationOptions = Omit<RouteApplicationOptions, 'router'> & { router?: RouterInstance };
type ArgumentsFor<Props, Previous extends unknown[]> = Props extends { constructor: (...args: infer Args) => unknown } ? Args
  : Props extends { initialize: (...args: infer Args) => unknown } ? Args : Previous;
type StateFor<Props> = Props extends { state: infer State } ? State
  : Props extends { createState: (...args: never[]) => infer State } ? State : object;
type FeatureInstance<Props extends object, Args extends unknown[], State, Statics extends object> =
  InstanceType<ApplicationConstructor<Props, Args, State, Statics>>;
// Application's merged instance pins lifecycle hook receivers to its base shape.
// Retain the ordinary optional initializer overload locally so that a required
// feature initializer still satisfies that shape after construction.
type OwnedFeature<Props extends object, Args extends unknown[], State, Statics extends object> =
  FeatureInstance<Props, Args, State, Statics> & {
    initialize(options?: FeatureInstance<Props, Args, State, Statics> extends { options: infer Options } ? Options : object): void;
  };
type FeatureConstructor<Props extends object, Args extends unknown[], State = object, Statics extends object = {}> =
  Omit<ApplicationConstructor<Props, Args, State, Statics>, 'extend'> & {
    new <Provided extends Args = Args>(...args: Provided): OwnedFeature<Props, Provided, State, Statics>;
    (this: object, ...args: Args): void;
    extend<Added extends object = {}, AddedStatics extends object = {}>(
      prototypeProperties?: Added & ThisType<OwnedFeature<Merge<Props, Added>, ArgumentsFor<Merge<Props, Added>, Args>, StateFor<Merge<Props, Added>>, Merge<Statics, AddedStatics>>>,
      staticProperties?: AddedStatics
    ): FeatureConstructor<Merge<Props, Added>, ArgumentsFor<Merge<Props, Added>, Args>, StateFor<Merge<Props, Added>>, Merge<Statics, AddedStatics>>;
  };
export type RouteApplicationConstructor = FeatureConstructor<RouteProperties, [options: RouteApplicationOptions]> & {
  withRouter(router: RouterInstance): FeatureConstructor<RouteProperties, [options?: ConfiguredRouteApplicationOptions]>;
};

// Registration follows feature ownership, independently of its visible pages.
function constructRouteApplication(this: RouteApplicationInstance, options: RouteApplicationOptions) {
  let unmount: (() => void) | undefined;
  this.on('before:destroy', () => unmount?.());
  Application.call(this, options);
  if (this.isDestroyed()) {return;}
  const router = this.getOption('router') as RouterInstance | undefined;
  if (!router || typeof router.mount !== 'function') {
    throw new TypeError('RouteApplication requires a router');
  }
  const routes = this.getOption('routes') as RouteApplicationInstance['routes'];
  const definitions = typeof routes === 'function' ? routes.call(this) : routes;
  if (this.isDestroyed()) {return;}
  const parent = this.getOption('routeParent') as string | undefined;
  unmount = router.mount(definitions, { parent, controller: this, owner: this });
  if (this.isDestroyed()) {unmount();}
}

export const RouteApplication = Application.extend({
  constructor: constructRouteApplication,
  routes: {},
}, {
  // Configure the shared engine before defining declarative child constructors.
  // Ordinary Application options still permit an explicit per-instance override.
  withRouter(router: RouterInstance) {
    return RouteApplication.extend({ router });
  },
}) as unknown as RouteApplicationConstructor;
