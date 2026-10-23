import { Router, defineRoutes, memoryDriver, type RouterInstance, type RouterOptions, type RouteNames, type RouteParams, type RouteTable } from '@mnjs/router';
import { Application, type LifecycleContext } from 'marionette';

const routes = defineRoutes([
  { name: 'home', path: '/' },
  { path: '/:workspace', children: {
    item: { path: 'items/:id{/:tab}?' },
    absolute: { path: '/standalone/:standaloneId' },
    file: { path: 'file-:id.:ext' },
  } },
  { name: 'escaped', path: '/literal/\\:label/:id' },
  { name: 'grouped', path: '/required{/part/:id}' },
  { name: 'optional', path: '/optional{/:id}?' },
  { name: 'escapedGroup', path: '/literal{\\}:id}?' },
]);

const literalPath: '/' = routes[0].path;
// @ts-expect-error Literal route definitions remain readonly.
routes[0].path = '/changed';
let name: RouteNames<typeof routes> = 'item';
name = 'absolute';
// @ts-expect-error Names are inferred through unnamed parents and child hashes.
name = 'missing';
const item: RouteParams<typeof routes, 'item'> = { workspace: 'team', id: 7, tab: null };
const optional: RouteParams<typeof routes, 'optional'> = {};
const optionalZero: RouteParams<typeof routes, 'optional'> = { id: 0 };
const escapedGroup: RouteParams<typeof routes, 'escapedGroup'> = { id: undefined };
const absolute: RouteParams<typeof routes, 'absolute'> = { standaloneId: '7' };
// @ts-expect-error Absolute child paths reset URL parameters from the parent.
const inheritedAbsolute: RouteParams<typeof routes, 'absolute'> = { workspace: 'team', standaloneId: '7' };
// @ts-expect-error Inherited parameters remain required for relative children.
const missingWorkspace: RouteParams<typeof routes, 'item'> = { id: 7 };
// @ts-expect-error Required parameter values exclude null.
const nullId: RouteParams<typeof routes, 'item'> = { workspace: 'team', id: null };
// @ts-expect-error Required parameter values exclude undefined.
const undefinedId: RouteParams<typeof routes, 'item'> = { workspace: 'team', id: undefined };
// @ts-expect-error Boolean path parameters are outside the runtime input contract.
const booleanTab: RouteParams<typeof routes, 'item'> = { workspace: 'team', id: 7, tab: false };
// @ts-expect-error Parameters in required brace groups remain required.
const missingGroup: RouteParams<typeof routes, 'grouped'> = {};
// @ts-expect-error An escaped colon does not introduce a parameter.
const escapedColon: RouteParams<typeof routes, 'escaped'> = { id: 7, label: 'literal' };

declare function call(...args: Parameters<RouterInstance<typeof routes>['url']>): void;
call('home');
call('item', item, { query: { selected: 1 } });
call('optional');
call('optional', { id: null });
call('file', { workspace: 'team', id: 7, ext: 'txt' });
// @ts-expect-error A required route cannot borrow the optional tuple of another name.
call('item');
// @ts-expect-error Zero-parameter routes reject arbitrary parameter keys.
call('home', { id: 7 });
// @ts-expect-error Embedded parameters are inferred separately.
call('file', { workspace: 'team', id: 7 });
// @ts-expect-error The helper accepts only inferred names.
call('typo', {});

const router = new Router({ routes });
router.url('home');
router.url('item', { workspace: 'team', id: 7 });
router.url('optional');
router.url('escaped', { id: 7 });
router.navigate('item', item, { history: 'replace' });
router.navigate('/runtime/route', { history: 'replace' });
router.navigate('https://example.test/runtime/route', { scroll: 'manual' });
// @ts-expect-error Misspelled names do not silently become raw relative URLs.
router.url('itme', { workspace: 'team', id: 7 });
// @ts-expect-error A known required route requires its parameter object.
router.url('item');
// @ts-expect-error Optional params do not make required params nullable.
router.navigate('item', { workspace: 'team', id: null });
// @ts-expect-error Unknown relative strings are not a typed-name escape.
router.navigate('unregistered');
const factoryRouter = new Router({ routes: () => routes });
factoryRouter.url('item', item);
// @ts-expect-error A factory returning a known table keeps the same required parameters.
factoryRouter.url('item');

const hashes = defineRoutes({
  section: { path: '/section/:sectionId', children: [
    { name: 'detail', path: 'detail/:detailId' },
  ] },
});
const hashRouter = new Router({ routes: hashes });
hashRouter.url('section', { sectionId: 1 });
hashRouter.url('detail', { sectionId: 1, detailId: 2 });
// @ts-expect-error Nested arrays preserve the inherited parameter requirement.
hashRouter.url('detail', { detailId: 2 });

const direct = new Router({ routes: [{ name: 'direct', path: '/direct/:id' }] });
direct.url('direct', { id: 7 });
// @ts-expect-error Constructor inference also preserves literal route names.
direct.url('other', { id: 7 });
// @ts-expect-error Constructor inference also preserves required parameters.
direct.url('direct');

const dynamic: RouteTable = [{ name: 'runtime', path: '/runtime/:id' }];
const dynamicRouter = new Router({ routes: dynamic });
dynamicRouter.url('registered-at-runtime', { arbitrary: 7 });
dynamicRouter.navigate('registered-at-runtime');
const dynamicPath: string = '/runtime/:id';
const namedDynamic = new Router({ routes: defineRoutes({ runtime: { path: dynamicPath } }) });
namedDynamic.url('runtime', { arbitrary: 7 });
// @ts-expect-error A broad path does not erase a known hash name.
namedDynamic.url('other');
const parentPath: string = '/:workspace';
const dynamicParent = defineRoutes([{ path: parentPath, children: [{ name: 'knownChild', path: 'child/:id' }] }]);
let childName: RouteNames<typeof dynamicParent> = 'knownChild';
// @ts-expect-error A dynamic pathname does not invent names for an unnamed parent.
childName = 'unknownChild';
const dynamicParentRouter = new Router({ routes: dynamicParent });
dynamicParentRouter.url('knownChild', { arbitrary: 7 });
const chosenName: 'first' | 'second' = Math.random() > 0.5 ? 'first' : 'second';
const chosenRouter = new Router({ routes: defineRoutes([{ name: chosenName, path: '/choice/:id' }]) });
chosenRouter.url('first', { id: 7 });
// @ts-expect-error A union of literal names still retains the path's required parameter.
chosenRouter.url('first');

const stateful = new Router({ routes, state: { count: 1 } });
const count: number = stateful.getState().count;
// @ts-expect-error Supplied Application state retains its shape.
stateful.getState().missing;
const owner = new Application();
const owned = owner.addChildApp('router', stateful);
owned.url('item', item);
// @ts-expect-error Application ownership preserves the router's literal catalog.
owned.url('item');
const catalog = new Router<typeof routes>({ driver: memoryDriver({ url: 'https://example.test/' }) });
catalog.mount(routes);
catalog.url('item', item);
// @ts-expect-error An explicit catalog narrows names without tracking mount availability.
catalog.url('unknown');

interface CustomRouterOptions extends RouterOptions { label: string }
const CustomRouter = Router.extend({
  initialize(options: CustomRouterOptions) { options.label.toUpperCase(); },
  async prepareStart(_options: unknown, { signal }: LifecycleContext) {
    signal.throwIfAborted();
    return { prepared: true };
  },
});
const custom = new CustomRouter({ label: 'catalog' });
const label: string = custom.options.label;
custom.prepareStart(undefined, { signal: new AbortController().signal }) satisfies Promise<{ prepared: boolean }>;
custom.onStart?.(custom, undefined, { prepared: true });
// @ts-expect-error Extended Routers retain required initialize options.
new CustomRouter();
// @ts-expect-error Application preparation result types remain intact.
custom.onStart?.(custom, undefined, { prepared: 'wrong' });

void [literalPath, name, item, optional, optionalZero, escapedGroup, absolute, inheritedAbsolute, missingWorkspace,
  nullId, undefinedId, booleanTab, missingGroup, escapedColon, childName, count, label];
