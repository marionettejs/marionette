import { Application } from 'marionette';
import { Router, RouteApplication, defineRoutes, memoryDriver } from '@mnjs/router';

/** @type {import('@mnjs/router').RouteHandler} */
const handleItem = (match, { signal }) => {
  signal.throwIfAborted();
  return match.params.id;
};
const routes = defineRoutes({
  item: { path: '/items/:id', handler: handleItem },
  search: { path: '/search{/:term}?' },
});
const router = new Router({ routes, driver: memoryDriver({ url: 'https://example.test/' }) });
router.url('item', { id: 0 });
router.navigate('item', { id: 'one' });
router.url('search');
router.url('search', { term: 'open' });
// @ts-expect-error A literal route requires its declared id parameter.
router.url('item');
// @ts-expect-error Declared route names are checked in JavaScript too.
router.navigate('missing');

const Feature = RouteApplication.extend({
  routes: { featureItem: { path: '/feature/:id', handler: 'showItem' } },
  /**
   * @param {unknown} _options Application startup options.
   * @param {import('marionette').LifecycleContext} context Preparation authority.
   * @returns {Promise<{ loaded: boolean }>} Prepared feature data.
   */
  async prepareStart(_options, { signal }) {
    signal.throwIfAborted();
    return { loaded: true };
  },
  /**
   * @param {import('@mnjs/router').ActiveMatch} match Current route.
   * @param {{ signal: AbortSignal }} context Navigation authority.
   * @returns {string} Selected item identifier.
   */
  showItem(match, { signal }) {
    signal.throwIfAborted();
    return match.params.id;
  },
});
const owner = new Application();
const feature = new Feature({ router });
owner.addChildApp('feature', feature);
// @ts-expect-error Feature registrations require a shared Router in JavaScript too.
new Feature();

/** @type {import('@mnjs/router').RouterInstance} */
const dynamicRouter = router;
const unmount = dynamicRouter.mount({ later: { path: '/later/:id', handler: 'showItem' } }, { controller: feature });
dynamicRouter.url('later', { id: 'two' });
unmount();
