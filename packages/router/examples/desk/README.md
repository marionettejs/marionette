# A desk with independently owned features

This small example uses a shared Router, an eager Catalog RouteApplication and
a lazy Activity RouteApplication. Both mount below the named `desk` URL parent.
Catalog belongs to the Desk Application; Activity belongs to its tools child.
Activity uses a sidebar Region while Catalog's page can remain attached. URL
ancestry does not choose Application ownership or stop unrelated content.

Copy this folder into an ESM application with the matching private router and
Marionette peer packages installed, plus the optional example dependencies
`@mnjs/adapters@5.0.1` and `lit-html@3.3.3`. PresentationView uses a function
template and a per-View Lit DOM adapter; ordinary expressions keep loaded content
and error messages as text. Give the example two DOM containers:

```js
import { Desk, Activity } from './desk.mjs';

const desk = new Desk({
  main: '#main',
  side: '#side',
  async load(id, { signal }) {
    const response = await fetch(`/api/catalog/${encodeURIComponent(id)}`, { signal });
    if (!response.ok) throw new Error(`Load failed: ${response.status}`);
    return response.text();
  },
});
const router = desk.getChildApp('navigation');
const tools = desk.getChildApp('tools');
await desk.start();
await router.start(); // enables routing without waiting for its initial page
const initial = await router.getInitialDispatch();
if (initial.status === 'failed') {
  desk.destroy();
  throw initial.error;
}
tools.addChildApp('activity', new Activity({
  router,
  tools,
  region: tools.getRegion(),
})); // registration only; it has not started Activity
await router.refresh(); // handles an existing /:desk/activity deep link
await router.navigate('item', { desk: 'blue', id: 'one' }).finished;
// Later, desk.stop() or desk.destroy() use normal Application ownership.
```

Use the [pre-import capability check](../../readme.md#check-capabilities-before-eager-application-imports)
before importing an application module that eagerly constructs a Desk. The app chooses its unsupported
environment response. An injected memory driver removes only the native
Navigation API requirement. Capability presence is not browser certification.

The Catalog page shows a loading view and owns a stable initial-presentation
promise. Calling `page.restart({ id, load })` before first readiness resolves the
old Application start false, but keeps that presentation promise pending until
the replacement attaches content or a handled error view. The route handler
explicitly awaits that promise. A stop settles it as stopped; a stale request is
observed and checks its signal before affecting UI. After initial readiness, a
local refresh has its own `restart()` promise and does not reopen initial readiness.

This is an example's contract, not a new router lifecycle API. An error view is
deliberately a fulfilled handler result here. Other apps may reject instead.
Neither behavior is inferred from a false value, and no rollback is promised.
The example uses ordinary Applications directly; it does not require a selector.
An unrelated tab group can use ChildAppSwitcher independently.

Stop/restart retain feature route registration; destruction unmounts it.
Desk stop/destroy ends routing and owned UI. Creating a new instance requires replacing
its Application registration; restarting does not allocate one. In this example,
the bootstrap lazily adds Activity with `tools.addChildApp`. Read an existing
instance with `tools.getChildApp('activity')`; after destruction, explicitly add
a new instance when needed. Starting Desk does not implicitly start its Router
or tools child. Their required activation stays explicit in the bootstrap and
Activity handler, rather than an asynchronous notification hook. Desk's ordinary
`prepareStart` awaits its eager Catalog child. No Router override or application
facade changes the meaning of `start`, `stop` or `destroy`. The bare `/:desk` URL
redirects to that desk's Catalog index, which retires old item/sidebar content.

From the framework checkout, run `npm run build` then
`npm run test:router-tarball`. The test installs actual tarballs, copies this
example from the installed package, and checks two-feature ownership, lazy refresh,
named URLs, gated replacement readiness, handled errors, late rejection and owner
teardown. Separate native tests run this same example in Chromium.
