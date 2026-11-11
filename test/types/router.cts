import { Router, RouteApplication, routeTable, defineRoutes, memoryDriver, navigationDriver, historyDriver,
  type Driver, type NavigationResult, type ActiveMatch, type Match, type RouterInstance, type RouterOptions,
  type RouteDefinition, type RouteHash, type RouteTable, type RouteNames, type RouteParams,
  type RouteApplicationInstance, type RouteApplicationOptions, type ApplicationRoutes, type SwitchOptions, type SelectionKey } from '@mnjs/router';
import { Application, type LifecycleContext } from 'marionette';
// @ts-expect-error Selection is private; the former public class is removed.
import { ChildAppSwitcher } from '@mnjs/router';

const driver: Driver = memoryDriver({ url: 'https://types.example/' });
const customDriver: Driver = {
  get currentEntry() { return driver.currentEntry; },
  entries: driver.entries, navigate: driver.navigate, reload: driver.reload,
  back: driver.back, traverseTo: driver.traverseTo, updateCurrentEntry: driver.updateCurrentEntry,
  addEventListener: driver.addEventListener,
};
navigationDriver(customDriver);
historyDriver({ window: globalThis.window });
// @ts-expect-error Static Driver capability flags are removed.
customDriver.capabilities;
// @ts-expect-error Memory needs an explicit initial URL.
memoryDriver();
// @ts-expect-error History expects a Window.
historyDriver({ window: 42 });
// @ts-expect-error Driver.navigate does not accept interception policy.
driver.navigate('/item', { scroll: 'manual' });
driver.updateCurrentEntry({ state: { preserved: true } });

const router = new Router({
  driver, routes: { '/': { name: 'home' } },
  owns(url) { return url.pathname !== '/outside'; },
  notFound: 'missing',
  handler(match, { signal }) { signal.throwIfAborted(); return match.name; },
});
const result: NavigationResult<boolean> = router.navigate('/item', { state: { selected: 1 }, scroll: 'manual' });
const readiness: Promise<boolean> = result.finished;
const idle: Match | null = router.match('/item');
if (idle) {
  // @ts-expect-error Pure matching has no navigation signal.
  idle.signal.throwIfAborted();
  // @ts-expect-error Engine branch data is opaque.
  idle.branch[0].data.mount;
}
// @ts-expect-error Router state updates are deferred; Driver state updates remain.
router.updateState({});
// @ts-expect-error The old ownership callback is removed.
const oldOwnership: RouterOptions = { intercept: () => true };
// @ts-expect-error Not-found configuration is a name.
const oldNotFound: RouterOptions = { notFound: { name: 'missing', within: () => true } };
// @ts-expect-error Explicit persistence lists are removed.
const oldPersistence: RouterOptions = { persistParams: ['team'] };
// @ts-expect-error Scroll policy has no auto value.
router.navigate('/item', { scroll: 'auto' });
// @ts-expect-error Focus uses the native literal values.
router.navigate('/item', { focusReset: 'preserve' });

const raw: RouteHash = {
  '/items/:id': { name: 'item', handler: 'show' },
  '/legacy/:id': { name: 'legacy', redirect: { name: 'item' } },
};
// @ts-expect-error Hash keys supply paths.
const wrongHash: RouteHash = { item: { path: '/items/:id' } };
// @ts-expect-error Route handlers are callbacks or method names.
const badHandler: RouteDefinition = { path: '/', name: 'bad', handler: 42 };
const callback = (match: ActiveMatch, { signal }: { signal: AbortSignal }) => { signal.throwIfAborted(); return match.name; };
const engineRoutes: RouteTable = [{ path: '/items/:id', name: 'item', handler: callback, data: { custom: true } }];
new Router({ routes: engineRoutes, driver });
const numeric = defineRoutes({ 404: { name: 'missing' }, '410': { name: 'gone' } });
new Router({ routes: numeric }).url('missing');
new Router({ routes: numeric }).url('gone');
const numericName: RouteNames<typeof numeric> = 'missing';
// @ts-expect-error Numeric paths do not become route names.
const numericPathName: RouteNames<typeof numeric> = '404';

const Leaf = RouteApplication.extend({
  routes: { 'detail/:detailId': { name: 'detail', handler: 'show' }, 404: { name: 'missing' } },
  show(match: ActiveMatch) { return match.params.detailId; },
});
const Group = RouteApplication.extend({
  childApps: { leaf: Leaf },
  routes: { 'item/:id': { mount: 'leaf', namespace: 'item' } },
});
const Root = RouteApplication.extend({
  childApps: { first: Group, second: Group, sidebar: Application },
  routes: {
    '/teams/:team': { mount: 'first', namespace: 'admin' },
    '/archive/:archiveTeam': { mount: 'second', namespace: 'archive' },
    '/': { name: 'home' },
  },
});
const compiled = routeTable(Root);
const strict = new Router({ routes: compiled });
strict.url('admin:item:detail', { team: 'blue', id: 'one', detailId: 'two' });
strict.url('archive:item:detail', { archiveTeam: 'old', id: 'one', detailId: 'two' });
strict.navigate('admin:item:missing', { team: 'blue', id: 'one' });
const compiledName: RouteNames<typeof compiled> = 'admin:item:detail';
const compiledParams: RouteParams<typeof compiled, 'admin:item:detail'> = { team: 'blue', id: 'one', detailId: 'two' };
// @ts-expect-error Compiled names retain namespaces.
const wrongCompiledName: RouteNames<typeof compiled> = 'detail';
// @ts-expect-error Different mounts retain their own parent parameters.
strict.url('archive:item:detail', { team: 'blue', id: 'one', detailId: 'two' });
// @ts-expect-error Compiled routes retain all required parameters.
strict.url('admin:item:detail', { team: 'blue', id: 'one' });
const explicit = new Router<typeof compiled>({ driver });
explicit.url(compiledName, compiledParams);
const sourceInstance = new Root();
const fromInstance = routeTable(sourceInstance);
new Router({ routes: fromInstance }).url('admin:item:detail', compiledParams);

const Absolute = RouteApplication.extend({ routes: { '/absolute/:absoluteId': { name: 'absolute' } } });
const AbsoluteRoot = RouteApplication.extend({
  childApps: { absolute: Absolute }, routes: { '/teams/:team': { mount: 'absolute', namespace: 'admin' } },
});
const absolute = routeTable(AbsoluteRoot);
new Router({ routes: absolute }).url('admin:absolute', { absoluteId: 'one' });
// @ts-expect-error Absolute child paths reset URL params while retaining namespace.
const inheritedAbsolute: RouteParams<typeof absolute, 'admin:absolute'> = { team: 'blue', absoluteId: 'one' };

const PlainNamespace = RouteApplication.extend({ childApps: { leaf: Leaf }, routes: [
  { path: '/without/:id', mount: 'leaf', namespace: '' },
] });
new Router({ routes: routeTable(PlainNamespace) }).url('detail', { id: 'one', detailId: 'two' });
const Override = Leaf.extend({ routes: { 'new/:newId': { name: 'replacement' } } });
const overridden = routeTable(Override);
new Router({ routes: overridden }).url('replacement', { newId: 'one' });
// @ts-expect-error Overridden declarations replace old leaf names.
const overriddenOldName: RouteNames<typeof overridden> = 'detail';
const Inherited = Root.extend({ label() { return 'root'; } });
const inherited = routeTable(Inherited);
new Router({ routes: inherited }).url('admin:item:detail', compiledParams);
const dynamicDeclarations: ApplicationRoutes = {};
const Dynamic = RouteApplication.extend({ routes: dynamicDeclarations });
new Router({ routes: routeTable(Dynamic) }).url('registered-at-runtime', { arbitrary: 1 });

const selection: RouteApplicationInstance = new RouteApplication();
selection.addChildApp('page', new Application());
selection.switchTo('page', { key: { id: 'one' }, restart: true, signal: new AbortController().signal, options: { id: 'one' } });
const readonlyKey: SelectionKey = { id: 'one', optional: undefined } as const;
const switchOptions: SwitchOptions = { key: readonlyKey, restart: false };
selection.switchTo('page', switchOptions);
const cleared: boolean = selection.clear();
const selected = selection.getCurrent();
// @ts-expect-error Arrays are not flat selection records.
selection.switchTo('page', { key: ['one'] });
// @ts-expect-error Nested records are not supported selection keys.
selection.switchTo('page', { key: { nested: { id: 'one' } } });
// @ts-expect-error Restart is per-call boolean.
selection.switchTo('page', { restart: 'always' });
// @ts-expect-error The former option is removed.
selection.switchTo('page', { reconstruct: true });
// @ts-expect-error The configured base helper is removed.
RouteApplication.withRouter(router);

interface FeatureOptions extends RouteApplicationOptions { prefix: string }
const Stateful = RouteApplication.extend({
  initialize(options: FeatureOptions) { options.prefix.toUpperCase(); },
  createState() { return { count: 0 }; },
  async prepareStart(_options: unknown, { signal }: LifecycleContext) { signal.throwIfAborted(); return { loaded: true }; },
  inspect() { return this.getState().count; },
}, { kind: 'feature', label() { return this.kind.toUpperCase(); } });
const stateful = new Stateful({ prefix: 'required' });
const count: number = stateful.inspect();
const stateCount: number = stateful.getState().count;
const staticLabel: string = Stateful.label();
stateful.onStart?.(stateful, undefined, { loaded: true });
// @ts-expect-error Preparation result inference is preserved.
stateful.onStart?.(stateful, undefined, { loaded: 'wrong' });
// @ts-expect-error Required initializer options remain required.
new Stateful();
// @ts-expect-error Required initializer fields are not supplied by prototype defaults.
new Stateful({});
// @ts-expect-error State shape is retained.
stateful.getState().missing;
const suppliedState = new Stateful({ prefix: 'required', state: { supplied: true } });
const supplied: boolean = suppliedState.getState().supplied;
const CustomConstructor = RouteApplication.extend({
  constructor(options: { token: string }) { RouteApplication.call(this, options); },
  token() { return this.options.token; },
});
new CustomConstructor({ token: 'required' }).token() satisfies string;
// @ts-expect-error A custom constructor keeps required arguments.
new CustomConstructor();
new RouteApplication({ onCleanupError(error, app) { void [error, app.isRunning(), this.getCurrent()]; } });
const DeclarativeOwner = Application.extend({ childApps: { routed: Root } });
const owner = new DeclarativeOwner();
owner.addChildApp('routed', new Root());
const remove: () => void = new Root().mountRoutes(router);
remove();
// @ts-expect-error Compilation does not widen an existing literal Router's catalog.
router.url('admin:item:detail', compiledParams);
// @ts-expect-error A leaf requires a string name.
RouteApplication.extend({ routes: { '/bad': { name: 42 } } });
// @ts-expect-error A leaf requires a name.
RouteApplication.extend({ routes: { '/bad': { handler: 'show' } } });
// @ts-expect-error Mount namespaces are strings.
RouteApplication.extend({ routes: { '/bad': { mount: 'leaf', namespace: 42 } } });
// @ts-expect-error Named mount regions are strings.
RouteApplication.extend({ routes: { '/bad': { mount: 'leaf', region: 42 } } });

type ErrorContext = import('@mnjs/router').RouteErrorContext;
const errorContext: ErrorContext = { info: { caller: 'navigation' } };
// @ts-expect-error Navigation provenance is readonly.
errorContext.info = 'changed';
const ErrorAware = RouteApplication.extend({
  handleRouteError(error: unknown, match: ActiveMatch, { mount, phase }: import('@mnjs/router').ApplicationRouteErrorContext) {
    const name: string | undefined = mount;
    const stage: 'start' | 'route' = phase;
    void [match, name, stage];
    throw error;
  },
});
new ErrorAware();
void [readiness, oldOwnership, oldNotFound, oldPersistence, raw, wrongHash, badHandler, numericName, numericPathName,
  wrongCompiledName, inheritedAbsolute, overriddenOldName, count, stateCount, staticLabel, supplied, cleared, selected];
