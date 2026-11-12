# @mnjs/router: feature-owned routing

Router is an optional, independently released companion. It is renderer-agnostic:
`@mnjs/html` is the recommended choice for a new application, not a Router
requirement. The example below is verified with Router 0.1.0, HTML 1.0.0 and
Marionette 5.0.1; these are evidence versions, not a requirement to pin every
compatible application to those exact versions.

## Read the installed contract first

After installation, read `node_modules/@mnjs/router/readme.md` for setup and
capabilities, `node_modules/@mnjs/router/DESIGN.md` for detailed contracts, and
`node_modules/@mnjs/router/examples/catalog/` for the larger shipped example.
These files belong to the installed Router version, not to core's documentation
manifest. When working with HTML, use `node_modules/@mnjs/html/guide.md` and
`node_modules/@mnjs/html/LIT_DIFFERENCES.md`. Read the package versions first.
The [tagged Router source](https://github.com/marionettejs/marionette/tree/router-v0.1.0/packages/router)
is a fallback for 0.1.0 when installed files are unavailable.

Router 0.1.0 requires Node 24.15 or newer and is tested on Chromium only.
Firefox and WebKit are untested. Check the [routing capability and driver
requirements](../guides/routing.md#use-the-optional-router-for-routed-applications)
before constructing it. A memory driver makes tests deterministic; it does not
certify browser navigation, focus, scroll or direct-link server behavior.

## A minimal HTML feature

Use this as `app.js` after the [quick start](../quick-start.md), add `@mnjs/router`,
and keep `<div id="app"></div>` in the page. Install compatible peers according to
the installed Router manifest. This example uses no data provider: plain object
snapshots supply each View's template data.

```js
import { Application, View } from 'marionette';
import { Router, RouteApplication } from '@mnjs/router';
import { html } from '@mnjs/html';
import HtmlDomApi from '@mnjs/html/marionette';

const Page = View.extend({
  template: ({ title }) => html`<h1>${title}</h1>`,
}).setDomApi(HtmlDomApi);

const Item = RouteApplication.extend({
  routes: {
    '': { name: 'item', handler: 'showItem' },
    'reviews': { name: 'reviews', handler: 'showReviews' },
  },
  async prepareStart({ id, loadItem }, { signal }) {
    return loadItem(id, { signal });
  },
  onStart(_app, _options, title) { this.title = title; },
  showItem() { this.showView(new Page({ model: { title: this.title } })); },
  showReviews() { this.showView(new Page({ model: { title: `Reviews: ${this.title}` } })); },
});
const Catalog = RouteApplication.extend({
  childApps: { item: Item },
  routes: {
    '/catalog': { name: 'catalog', handler: 'showCatalog' },
    '/catalog/:id': { mount: 'item', namespace: 'catalog' },
  },
  childRouteOptions() { return { loadItem: this.getOption('loadItem') }; },
  showCatalog() { this.showView(new Page({ model: { title: 'Catalog' } })); },
});

export function createApp({ driver, loadItem = async id => `Item ${id}` } = {}) {
  const frame = new Application();
  const router = frame.addChildApp('navigation', new Router({ driver }));
  const catalog = frame.addChildApp('catalog', new Catalog({
    region: { el: '#app' }, loadItem,
  }));
  catalog.mountRoutes(router);
  return {
    frame, router, catalog,
    async start() {
      try {
        await frame.start();
        await catalog.start();
        await router.start();
        const result = await router.getInitialDispatch();
        if (result.status === 'failed') throw result.error;
        return result;
      } catch (error) {
        frame.destroy();
        throw error;
      }
    },
  };
}
```

In the browser entry module, import `createApp`, create it without a driver to use
the native Navigation API, and await `app.start()` inside the host's error boundary.
Serve `/catalog` and `/catalog/42` through the same application entry. The initial
URL is dispatched by startup. Unmatched URLs have no fallback in this minimal
example; choose the host's missing-page policy explicitly.

For an interaction, return or await
`app.router.navigate('catalog:item', { id: '42' }).finished` and handle its rejection.
The promise resolves `false` for cancellation, not success. Keep event handlers
in View `events`/`triggers`, not template event bindings. Required loading runs in
Item preparation once per selected ID; moving to its reviews leaf retains that
prepared child. Changing ID reloads it. `app.frame.destroy()` tears down Router,
feature Applications and displayed Views. No manually maintained route-to-View
registry or second loader is needed.

The factory's `driver` argument is an explicit testing/integration seam. For a
memory test, import `memoryDriver` from `@mnjs/router` and pass
`memoryDriver({ url: 'https://example.test/catalog/42' })`. Await `app.start()`,
navigate to the reviews leaf and a different ID, assert rendered content/loading,
then destroy the frame. Memory/History drivers additionally require
`structuredClone`; memory does not remove the package's other capabilities.

The executable companion check runs this exact fence against public npm packages,
with the memory driver and a DOM environment, and separately compiles a TypeScript
consumer. It is distinct from core's Node 22 checks because Router has a higher
Node floor. It does not establish real-browser behavior or benchmark performance.
