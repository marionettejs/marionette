import { Router, defineRoutes, memoryDriver, type RouterInstance, type RouterOptions, type RouteNames, type RouteParams, type RouteTable } from '@mnjs/router';
import { Application, type LifecycleContext } from 'marionette';

const routes = defineRoutes({
  home: { path: '/' },
  item: { path: '/items/:id{/:tab}?' },
  file: { path: '/file-:id.:ext' },
  workspace: { path: '/:workspace', children: [
    { name: 'child', path: 'child/:id' },
    { name: 'absolute', path: '/absolute/:id' },
  ] },
});
const literalPath: '/' = routes.home.path;
let name: RouteNames<typeof routes> = 'child';
// @ts-expect-error Hash and child-array names remain literal.
name = 'typo';
const child: RouteParams<typeof routes, 'child'> = { workspace: 'team', id: 7 };
// @ts-expect-error Relative children retain required parent parameters.
const missingParent: RouteParams<typeof routes, 'child'> = { id: 7 };
const absolute: RouteParams<typeof routes, 'absolute'> = { id: 7 };
const optional: RouteParams<typeof routes, 'item'> = { id: 7, tab: null };
// @ts-expect-error Required values exclude null.
const nullable: RouteParams<typeof routes, 'item'> = { id: null };

declare function call(...args: Parameters<RouterInstance<typeof routes>['url']>): void;
call('home');
call('item', { id: 7 });
// @ts-expect-error A required route cannot use a different name's optional tuple.
call('item');

const router = new Router({ routes });
router.url('home');
router.url('item', { id: 7, tab: undefined });
router.navigate('file', { id: 7, ext: 'txt' });
router.navigate('/runtime/route', { history: 'replace' });
// @ts-expect-error Unknown names are rejected in CommonJS consumers too.
router.url('typo');
// @ts-expect-error Named calls require the embedded extension parameter.
router.navigate('file', { id: 7 });
const dynamic: RouteTable = [];
new Router({ routes: dynamic }).url('registered-at-runtime', { arbitrary: 7 });
const stateful = new Router({ routes, state: { count: 1 } });
const count: number = stateful.getState().count;
// @ts-expect-error Supplied Application state retains its shape.
stateful.getState().missing;
const owner = new Application();
const owned = owner.addChildApp('router', stateful);
// @ts-expect-error Application ownership retains the router's known names.
owned.url('unknown');
const catalog = new Router<typeof routes>({ driver: memoryDriver({ url: 'https://example.test/' }) });
catalog.url('item', { id: 7 });
// @ts-expect-error Explicit catalogs still require known route parameters.
catalog.url('item');
interface CustomRouterOptions extends RouterOptions { label: string }
const CustomRouter = Router.extend({
  initialize(options: CustomRouterOptions) { options.label.toUpperCase(); },
  async prepareStart(_options: unknown, { signal }: LifecycleContext) { signal.throwIfAborted(); return { prepared: true }; },
});
const custom = new CustomRouter({ label: 'catalog' });
custom.onStart?.(custom, undefined, { prepared: true });
// @ts-expect-error Extended Routers retain required initialize options.
new CustomRouter();
// @ts-expect-error The preparation result remains typed in CommonJS consumers.
custom.onStart?.(custom, undefined, { prepared: 'wrong' });
void [literalPath, name, child, missingParent, absolute, optional, nullable, count];
