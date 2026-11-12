# Connect navigation to feature ownership

Marionette v5 supplies UI and Application lifecycles. Choose browser navigation or a separate router for URL matching and history. Connect route decisions to the owner that shows or starts the destination feature.

## Use the optional Router for routed applications

For a new application needing named URLs, nested feature routes or coordinated
route transitions, use optional `@mnjs/router` with compatible Marionette peers. The HTML-first
example is verified with `@mnjs/router@0.1.0` and `@mnjs/html@1.0.0`; these
are tested versions, not a Router renderer requirement. Router is independently versioned and optional, not part of
core's coordinated release. Keep an existing host router rather than adding a
second global URL owner. The [native fragment-navigation alternative](fragment-navigation.md) remains
valid when you do not need a routing package.

Start with the copyable HTML feature below.
Read the installed `node_modules/@mnjs/router/readme.md` and `DESIGN.md` for
version-matched contracts; [companion discovery](../packages/router.md#read-the-installed-contract-first)
identifies the renderer and larger example paths. No framework checkout is needed.

Use one browser `Router` and let each `RouteApplication` declare the routes and
children it owns. A mount selects its registered child before dispatching the
child's local handler. Keep required data loading in `prepareStart`, apply the
prepared result in `onStart`, and let Views and Regions own displayed content.
The route matcher does not infer ownership from URL nesting. Do not duplicate
Application preparation with a separate route-handler loading system.

`mountRoutes(router)` registers routes but does not activate the root owner.
Start independently registered roots before starting the Router; mounted children
start through selection. Await `router.getInitialDispatch()` and handle a failed
initial dispatch. For later named navigation, await the returned handle's
`.finished` promise: `true` means completed, `false` means cancelled, and
failure rejects. Handle rejection at its owner. Changing a mount's own
parameters stops and starts the same registered child instance; changing a leaf
under the same mount can retain that child. Stop retains registrations; destroy
unmounts them. After stop/start, explicitly restart required roots and Router.

**Check the supported environment before choosing this package.** Version 0.1.0
is tested on Chromium only; Firefox and WebKit are untested. It requires
`URLPattern`, `AbortSignal.any`, `Promise.withResolvers` and `URL.canParse`; the
default driver also requires the Navigation API. `historyDriver()` is an explicit
alternative, not an automatic fallback, and additionally needs `structuredClone`.
Transpilation does not supply these APIs. Follow the
[capability check and driver contracts](https://github.com/marionettejs/marionette/blob/router-v0.1.0/packages/router/readme.md#check-capabilities-before-eager-application-imports)
before eagerly constructing a Router. Router's Node minimum is 24.15, independent
of core's Node 22 consumer floor. A missing capability is not a reason to silently
replace a host's navigation policy.

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
        if (!await frame.start() || !await catalog.start() || !await router.start()) {
          frame.destroy();
          return { status: 'cancelled' };
        }
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

## Alternatives and browser verification

Keep an existing host router and follow the [existing UI boundary](existing-ui.md). For a small standalone application without a routing package, use the [native fragment examples](fragment-navigation.md). Do not combine those global listeners with Router. Test direct links, Back/Forward, focus and scroll in a real browser; memory-driver checks do not certify them.
