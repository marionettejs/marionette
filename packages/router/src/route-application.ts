import { Application } from 'marionette';
import type { ApplicationConstructor, ApplicationInstance, ApplicationOptions } from 'marionette';
import type { RouterInstance } from './router.ts';
import type { RouteTable } from './types.ts';

export interface RouteApplicationOptions extends ApplicationOptions {
  router: RouterInstance;
  routes?: RouteTable | ((this: RouteApplicationInstance) => RouteTable);
}
export type RouteApplicationInstance = Omit<ApplicationInstance<RouteApplicationOptions, unknown>, 'routes'> & {
  routes: NonNullable<RouteApplicationOptions['routes']>;
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
  unmount = router.mount(definitions, { controller: this });
  if (this.isDestroyed()) {unmount();}
}

export const RouteApplication = Application.extend({
  constructor: constructRouteApplication,
  routes: {},
}) as unknown as ApplicationConstructor<Pick<RouteApplicationInstance, 'routes'>, [options: RouteApplicationOptions]>;
