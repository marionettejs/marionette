# Feature routes with an ordinary Application

The [Catalog Application](catalog.mjs) owns its local `routeTo` operation and
shows a named CatalogView. Its route table is ordinary data. Register it with
the existing `Router.mount` API, choosing the Application as both controller
and registration owner. No extra feature-registration or UI-mounting helper is needed.

The View uses Marionette's default function-template renderer with Lit output and
the per-View Lit DOM adapter. Install these optional example dependencies alongside
the router and its Marionette peer: `@mnjs/adapters@5.0.1` and `lit-html@3.3.3`.
Ordinary Lit child expressions escape text; do not use raw HTML for fetched titles.

```js
import { Application } from 'marionette';
import { Router } from '@mnjs/router';
import { Catalog, catalogRoutes } from './catalog.mjs';

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
router.mount(catalogRoutes, { owner: catalog, controller: catalog });
await frame.start();
await router.start();
const initial = await router.getInitialDispatch();
if (initial.status === 'failed') {
  frame.destroy();
  throw initial.error;
}
await router.navigate('catalog', { id: '42' }).finished;
```

Check the required capabilities before eagerly constructing this Router, as in
the [package bootstrap recipe](../../readme.md#check-capabilities-before-eager-application-imports).
Supply `#content`. Registration does not start an Application or render UI.
`routeTo` returns the ordinary `restart()` promise. Preparation loads data;
the synchronous `onStart` notification presents CatalogView through its Region.
This example deliberately reloads on every dispatch, including repeated IDs and
refresh. `start({ id })` alone would retain an active Application without loading
again. Use keyed child selection when retention is the desired policy.

The request observes both the Application preparation signal and route signal.
Preparation and presentation check authority, so navigation away cannot attach
stale UI even if a request ignores abort. A later `restart` cancels the previous
preparation; stopping/destroying the owner cancels its lifecycle work. These are
distinct from Router cancellation. Required work is returned to the Router.
The bootstrap inspects the non-rejecting initial outcome and destroys its owner
before rethrowing a failed initial dispatch; it does not silently accept failed
startup. Other routing errors remain available through `route:error` and rejected
operation promises according to the application's observation policy.

`catalog.stop()` stops its UI but leaves the route registered; navigating or
refreshing that route may start it again. `catalog.destroy()` retires the
registration and cancels its route work. Stopping/destroying the frame also stops
routing. A different area's handler explicitly stops or clears content it leaves;
it need not activate an area just to clean it up. Independent sidebars can remain
owned elsewhere. Route metadata can describe the area an app chooses to present;
it does not activate anything or derive ownership from URL paths.

Keep a real feature's richer `routeTo` boundary local to that feature. The optional
RouteApplication remains useful when the feature independently declares and owns
its registrations, as in the [desk example](../desk/README.md). Neither pattern
requires all features to use the same ownership shape. A feature that replaces its
own first startup still owns its stable presentation promise; this small example
does not implement that separate policy.
