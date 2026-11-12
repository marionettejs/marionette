# A Catalog that owns its routes and item lifecycle

The [Catalog Application](catalog.mjs) declares its own list page and an Item mount.
The Item child declares its local item/reviews leaves, loads in prepareStart and
shows a named View through its Region. A mount starts/joins that child by its own
id parameter before calling the leaf. Same ID retains preparation; changed ID
stops/starts the registered instance. The list page stops the mounted Item.

The View uses a function template and a per-View HTML DOM adapter. Install the
optional consumer dependency @mnjs/html alongside
the router and its Marionette peer. Ordinary HTML expressions keep fetched text
escaped; no global renderer override or raw HTML insertion is needed.

```js
import { Application } from 'marionette';
import { Router } from '@mnjs/router';
import { Catalog } from './catalog.mjs';

const frame = new Application();
const router = frame.addChildApp('navigation', new Router());
const catalog = frame.addChildApp('catalog', new Catalog({
  region: { el: '#content' },
  async loadItem(id, { signal }) {
    const response = await fetch(`/api/items/${encodeURIComponent(id)}`, { signal });
    if (!response.ok) throw new Error(`Item request failed: ${response.status}`);
    return (await response.json()).title;
  },
}));
catalog.mountRoutes(router);
router.on('route:error', (error, match) => console.error(match?.name, error));
await frame.start();
await catalog.start();
await router.start();
const initial = await router.getInitialDispatch();
if (initial.status === 'failed') {
  frame.destroy();
  throw initial.error;
}
await router.navigate('catalog:item', { id: '42' }).finished;
await router.navigate('catalog:reviews').finished; // same mounted item, no reload
```

Provide #content and check [runtime requirements](../../readme.md#check-capabilities-before-eager-application-imports)
before eager Router construction. Mounting registers only; start the root Catalog
before dispatch. Mounted descendants activate through routeBranch. No route method
repeats root startup or uses a second routing map. childRouteOptions explicitly
passes the loader into the Item start options.

A request observes the Application preparation signal; the mount separately checks
route authority before dispatch. Same-key routes can share pending preparation,
so aborting one route does not cancel that shared work. Changing the key or clearing
the mounted child cancels its lifecycle preparation. The list route, owner teardown
and a different area's explicit catalog.clear() prevent stale work from attaching.
Independent panes can retain their own content. Preparation errors bubble through
handleRouteError and then route:error unless handled; observe operation promises too.
The initial result never rejects, so bootstrap checks its failed outcome explicitly.

catalog.stop() retains registration but stops owned UI; explicitly start it before
future dispatch. catalog.destroy() retires routes and cancels their work. Mounting
an already-current URL requires router.refresh(). The old /products/:id route uses
a named redirect, forwarding source params/query/hash. It has no duplicate handler.

The distinct [Desk example](../desk/README.md) demonstrates lazy independent route
registration and a feature-owned replacement-presentation promise. That special
readiness policy does not belong to every mounted feature.
