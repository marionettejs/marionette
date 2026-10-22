import { Router, memoryDriver, navigationDriver, type ActiveMatch, type Match, type Driver, type NavigationResult, type RouterOptions, type RouterInstance } from '@mnjs/router';
import { ChildAppSwitcher, type ChildAppSwitcherInstance, type ChildAppSwitcherOptions } from '@mnjs/router';
import { Application, createMarionette } from 'marionette';

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
const result: NavigationResult<boolean> = router.navigate('home', {}, { state: { selected: 2 } });
const readiness: Promise<boolean> = result.finished;
const idle: Match | null = router.match('/');
if (idle) {
  // @ts-expect-error Pure matching provides no navigation signal.
  idle.signal.throwIfAborted();
}
navigationDriver(window.navigation);
router.listenTo(router, 'route', (match: ActiveMatch) => match.name);
const owner = new Application();
const switcher: ChildAppSwitcherInstance = new ChildAppSwitcher({ owner });
const extended = ChildAppSwitcher.extend({
  initialize(_options: ChildAppSwitcherOptions) { this.switchTo('page'); },
  isSelected() { return this.getCurrent() !== null; },
});
const child = new extended({ owner });
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
const runtime = createMarionette();
const ScopedRouter = Router.extend({ Radio: runtime.Radio, State: runtime.MnObject.prototype.State });
new ScopedRouter({ driver }).destroy();
switcher.switchTo('page', { reconstruct: true });
// @ts-expect-error Reconstruction is explicit; old outlet restart option is removed.
switcher.switchTo('page', { restart: true });
void [base, itemUrl, changed];
