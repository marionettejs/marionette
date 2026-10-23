import { Router, memoryDriver, navigationDriver, type ActiveMatch, type Match, type Driver, type NavigationResult, type RouterOptions, type RouterInstance, type RouteDefinition } from '@mnjs/router';
import { ChildAppSwitcher, RouteApplication, defineRoutes, type ChildAppSwitcherInstance, type ChildAppSwitcherOptions, type RouteApplicationOptions, type RouteApplicationInstance, type RouteTable, type RouteHash, type RouteHandler, type MountOptions } from '@mnjs/router';
// @ts-expect-error Runtime-bound constructor factories are not public package exports.
import { createRouterClass, createChildAppSwitcherClass } from '@mnjs/router';
import { Application, type LifecycleContext } from 'marionette';

const driver: Driver = memoryDriver({ url: 'http://localhost/' });
// @ts-expect-error Memory navigation requires an explicit initial document URL.
memoryDriver();
// @ts-expect-error An options object alone supplies no initial URL.
memoryDriver({});
const router = new Router({
  routes: [{ name: 'home', path: '/' }], driver,
  handler(match: ActiveMatch, { signal }) {
    signal.throwIfAborted();
    match.signal.throwIfAborted();
    return Promise.resolve();
  },
});
// @ts-expect-error Alias route configuration was removed; use a named redirect route.
const removedAlias: RouteDefinition = { name: 'old', path: '/old', aliases: [] };
void removedAlias;
// @ts-expect-error Alias inspection was removed.
router.getAliases();
const result: NavigationResult<boolean> = router.navigate('home', {}, { state: { selected: 2 } });
const readiness: Promise<boolean> = result.finished;
const idle: Match | null = router.match('/');
if (idle) {
  // @ts-expect-error Pure matching provides no navigation signal.
  idle.signal.throwIfAborted();
  // @ts-expect-error Matches no longer expose alias metadata.
  const oldAlias = idle.alias;
  void oldAlias;
}
navigationDriver(window.navigation);
router.listenTo(router, 'route', (match: ActiveMatch) => match.name);
const owner = new Application();
const switcher: ChildAppSwitcherInstance = owner.addChildApp('pages', new ChildAppSwitcher());
const extended = ChildAppSwitcher.extend({
  initialize(_options: ChildAppSwitcherOptions) { this.getCurrent(); },
  isSelected() { return this.getCurrent() !== null; },
});
const child = new extended({});
const selected: boolean = child.isSelected();
switcher.switchTo('page', { key: { id: 'one', branch: ['a'] }, options: { id: 'one' } });
// @ts-expect-error Switcher keys are primitive, arrays or plain objects.
switcher.switchTo('page', { key: new Map() });
// @ts-expect-error Driver events have typed destinations and interception.
driver.addEventListener('navigate', (event: { missing: string }) => event.missing);
// @ts-expect-error Router state is a plain object, not a Map.
router.updateState(new Map());
void [readiness, selected];

interface CatalogOptions extends RouterOptions { scope: string }
const CatalogRouter = Router.extend({
  options: { maxRedirects: 3 },
  initialize(options: CatalogOptions) {
    const scope: string = options.scope;
    this.url('item', { id: scope });
  },
  routes() {
    this.getOption('scope');
    return [{ name: 'item', path: '/items/:id' }];
  },
  handler(match: ActiveMatch, { signal }: { signal: AbortSignal }) {
    signal.throwIfAborted();
    return this.showItem(match);
  },
  onRouteReady(match: ActiveMatch) { this.trigger('item:ready', match); },
  showItem(match: ActiveMatch) { return this.url(match.name, match.params); },
});
const catalog = new CatalogRouter({ scope: 'public', driver });
const base: RouterInstance = catalog;
const itemUrl: string = catalog.showItem(catalog.getCurrent()!);
const changed: boolean = catalog.updateState({ selected: 3 });
catalog.destroy();
// @ts-expect-error Subclass initialize requires its declared options.
new CatalogRouter({ driver });
const ownedRouter = owner.addChildApp('router', new Router({ driver }));
const activated: Promise<boolean> = ownedRouter.start();
const restarted: Promise<boolean> = ownedRouter.restart();
const available: boolean = ownedRouter.canGoBack();
const disposed: boolean = ownedRouter.destroy();
void [activated, restarted, available, disposed];
const PreparedRouter = Router.extend({
  async prepareStart(_options: unknown, { signal }: LifecycleContext) {
    signal.throwIfAborted();
    return { prepared: true };
  },
});
const preparedRouter = owner.addChildApp('prepared', new PreparedRouter({ driver }));
preparedRouter.prepareStart(undefined, { signal: new AbortController().signal }) satisfies Promise<{ prepared: boolean }>;
preparedRouter.onStart?.(preparedRouter, undefined, { prepared: true });
// @ts-expect-error Ordinary Application startup results preserve the preparation return type.
preparedRouter.onStart?.(preparedRouter, undefined, { prepared: 'yes' });
switcher.start();
switcher.switchTo('page', { reconstruct: true, signal: new AbortController().signal });
const cleared: boolean = switcher.clear();
void cleared;
// @ts-expect-error Reconstruction is explicit; old outlet restart option is removed.
switcher.switchTo('page', { restart: true });
void [base, itemUrl, changed];

const routeCallback: RouteHandler = (match, { signal }) => {
  signal.throwIfAborted();
  return match.params.id;
};
const namedRoutes: RouteHash = {
  'catalog:item': { path: '/catalog/:id', handler: 'showItem', children: {
    'catalog:detail': { path: 'detail', handler: routeCallback },
  } },
};
const readonlyRoutes: readonly RouteDefinition[] = [{ name: 'list', path: '/list', handler: routeCallback }];
const declaredTable: RouteTable = readonlyRoutes;
const hashRouter = new Router({ driver, routes: namedRoutes });
const callbackRouter = new Router({ driver, routes: () => declaredTable });
const LiteralRouter = Router.extend({ routes: defineRoutes({ declared: { path: '/declared/:id' } }) });
const literalRouter = new LiteralRouter({ driver });
literalRouter.url('declared', { id: 7 });
// .extend() retains its ordinary broad route contract in this bounded pass.
literalRouter.url('registered-at-runtime', { arbitrary: 7 });
const controller = { showItem: routeCallback };
const mountOptions: MountOptions = { parent: 'catalog:item', controller };
const unmount: () => void = hashRouter.mount({ mounted: { path: 'mounted', handler: 'showItem' } }, mountOptions);
hashRouter.mount(readonlyRoutes, { controller });
// @ts-expect-error A hash key owns its route name; its definition cannot add another name.
const duplicateHashName: RouteHash = { item: { name: 'other', path: '/item' } };
// @ts-expect-error Route handlers are callbacks or controller method names.
const invalidRouteHandler: RouteDefinition = { path: '/item', handler: 42 };
// @ts-expect-error Nested route definitions accept the same hash/array forms, not strings.
const invalidChildren: RouteDefinition = { path: '/item', children: 'detail' };
// @ts-expect-error Controller bindings require an object.
hashRouter.mount(namedRoutes, { controller: 'controller' });

interface FeatureOptions extends RouteApplicationOptions { prefix: string }
const Feature = RouteApplication.extend({
  initialize(options: FeatureOptions) { const prefix: string = options.prefix; void prefix; },
  routes() {
    return { featureItem: { path: '/features/:id', handler: 'showItem' } };
  },
  async prepareStart(_options: unknown, { signal }: LifecycleContext) {
    signal.throwIfAborted();
    return { loaded: true };
  },
  showItem(match: ActiveMatch, { signal }: { signal: AbortSignal }) {
    signal.throwIfAborted();
    return match.params.id;
  },
});
const featureInstance = new Feature({ router, prefix: 'public' });
const feature = owner.addChildApp('feature', featureInstance);
const featureBase: RouteApplicationInstance = feature;
feature.prepareStart(undefined, { signal: new AbortController().signal }) satisfies Promise<{ loaded: boolean }>;
type FeatureStartResult = Parameters<NonNullable<typeof feature.onStart>>[2];
const featureStartResult: FeatureStartResult = { loaded: true };
// @ts-expect-error Preparation results retain ordinary Application inference.
const wrongFeatureStartResult: FeatureStartResult = { loaded: 'yes' };
// @ts-expect-error A RouteApplication requires a shared Router.
new RouteApplication();
// @ts-expect-error Supplying routes does not replace the required Router.
new RouteApplication({ routes: namedRoutes });
// @ts-expect-error Extended initializer options are still required.
new Feature({ router });
new RouteApplication({ router, routes: namedRoutes });
new RouteApplication({ router, routes: () => readonlyRoutes });
void [hashRouter, callbackRouter, unmount, duplicateHashName, invalidRouteHandler, invalidChildren, featureBase];
