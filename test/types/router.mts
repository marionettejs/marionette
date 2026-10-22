import { Router, memoryDriver, navigationDriver, type ActiveMatch, type Match, type Driver, type NavigationResult, type RouterOptions, type RouterInstance, type RouteDefinition } from '@mnjs/router';
import { ChildAppSwitcher, type ChildAppSwitcherInstance, type ChildAppSwitcherOptions } from '@mnjs/router';
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
const activationType: Driver['activation'] = navigationDriver(window.navigation).activation;
memoryDriver({ url: 'https://example.test/', activation: { navigationType: 'reload' } });
memoryDriver({ url: 'https://example.test/', activation: null });
// @ts-expect-error Document activation uses the native NavigationType union.
memoryDriver({ url: 'https://example.test/', activation: { navigationType: 'initial' } });
router.navigate('/items', { focusReset: 'manual', scroll: 'after-transition' });
router.navigate('home', {}, { scroll: 'manual' });
// @ts-expect-error Native scroll behavior has no auto value.
router.navigate('home', {}, { scroll: 'auto' });
// @ts-expect-error Focus behavior uses native literal values.
router.navigate('home', {}, { focusReset: 'preserve' });
// @ts-expect-error These are intercept options, not native Driver navigate options.
driver.navigate('/items', { scroll: 'manual' });
void activationType;
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
