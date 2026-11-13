import { Application } from 'marionette';
import { Router, RouteApplication, routeTable, defineRoutes, memoryDriver, historyDriver } from '@mnjs/router';
import { historyDriver as separateHistoryDriver } from '@mnjs/router/history';
/** @type {typeof historyDriver} */
const historyFactory = separateHistoryDriver;
// @ts-expect-error The separate History entry requires a Window.
historyFactory({ window: 42 });
const memory = memoryDriver({ url: 'https://example.test/' });
/** @type {import('@mnjs/router').Driver} */
const customDriver = {
  get currentEntry() { return memory.currentEntry; },
  entries: memory.entries, navigate: memory.navigate, reload: memory.reload,
  back: memory.back, traverseTo: memory.traverseTo, updateCurrentEntry: memory.updateCurrentEntry,
  addEventListener: memory.addEventListener,
};
// @ts-expect-error Static Driver capability flags are removed.
customDriver.capabilities;
/** @type {import('@mnjs/router').RouteHandler} */
const handleItem = (match, { signal }) => { signal.throwIfAborted(); return match.params.id; };
const routes = defineRoutes({
  '/items/:id': { name: 'item', handler: handleItem },
  '/search{/:term}?': { name: 'search' },
  404: { name: 'missing' },
});
const router = new Router({ routes, driver: customDriver, owns: url => url.pathname !== '/outside', notFound: 'missing' });
router.url('item', { id: 'one' });
router.url('search');
router.url('missing');
// @ts-expect-error A known route needs its id.
router.url('item');
// @ts-expect-error Path keys do not become route names.
router.url('/items/:id');
const Child = RouteApplication.extend({
  routes: { 'detail/:id': { name: 'detail', handler: 'show' } },
  /**
   * @param {import('@mnjs/router').ActiveMatch} match Current route.
   * @returns {string} Selected identifier.
   */
  show(match) { return match.params.id; },
});
const Root = RouteApplication.extend({
  childApps: { child: Child },
  routes: { '/teams/:team': { mount: 'child', namespace: 'team' } },
});
const compiled = routeTable(Root);
new Router({ routes: compiled }).url('team:detail', { team: 'blue', id: 'one' });
// @ts-expect-error Namespaced names remain checked in JavaScript.
new Router({ routes: compiled }).url('detail', { team: 'blue', id: 'one' });
// @ts-expect-error Parent parameters remain required in JavaScript.
new Router({ routes: compiled }).url('team:detail', { id: 'one' });
const owner = new Application();
const root = owner.addChildApp('root', new Root());
root.mountRoutes(router);
const pages = new RouteApplication();
pages.addChildApp('page', new Application());
pages.switchTo('page', { key: { id: 'one' }, restart: true });
// @ts-expect-error Selection is flat.
pages.switchTo('page', { key: ['one'] });
// @ts-expect-error The configured base helper is removed.
RouteApplication.withRouter(router);
// @ts-expect-error Router state mutation is deferred.
router.updateState({});
/** @type {import('@mnjs/router').RouteErrorContext} */
const provenance = { info: undefined };
/** @type {import('@mnjs/router').RedirectTarget} */
const target = { name: 'item', params: { id: 'one' }, hash: '#details' };
/** @type {import('@mnjs/router').RouteTable} */
const redirects = { '/legacy/:id': { name: 'legacy', redirect: target } };
new Router({ routes: redirects, driver: historyDriver({ window: globalThis.window }) });
// @ts-expect-error History requires a Window.
historyDriver({ window: 1 });
void provenance;
