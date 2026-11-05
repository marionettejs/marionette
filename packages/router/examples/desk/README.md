# A desk with independently owned features

This small example uses a shared Router, an eager Catalog RouteApplication and
a lazy Activity RouteApplication. Both mount below the named `desk` URL parent.
Catalog belongs to the frame; Activity belongs to an independent tools Application.
Activity uses a sidebar Region while Catalog's page can remain attached. URL
ancestry does not choose Application ownership or stop unrelated content.

Copy this folder into an ESM application with the matching private router and
Marionette peer packages installed. Give the example two DOM containers:

```js
import { navigationDriver } from '@mnjs/router';
import { createDesk } from './desk.mjs';

const app = createDesk({
  main: document.querySelector('#main'),
  side: document.querySelector('#side'),
  driver: navigationDriver(),
  load: async(id, { signal }) => {
    const response = await fetch(`/api/catalog/${encodeURIComponent(id)}`, { signal });
    if (!response.ok) throw new Error(`Load failed: ${response.status}`);
    return response.text();
  },
});
await app.start(); // enables routing without waiting for its initial page
const initial = await app.router.getInitialDispatch();
app.mountActivity(); // registration only; it has not started Activity
await app.router.refresh(); // handles an existing /:desk/activity deep link
await app.router.navigate('item', { desk: 'blue', id: 'one' }).finished;
```

Check the capabilities in `bootstrap.mjs` **before** importing an application
module that eagerly constructs this example. The app chooses its unsupported
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

Stop/restart retain feature route registration; destruction unmounts it. Frame
stop/destroy ends routing and owned UI. Creating a new instance requires replacing
its Application registration; restarting does not allocate one. In this example,
calling `mountActivity()` again after destruction explicitly registers a new
Activity instance. Calling it while the instance exists reuses it.

From the framework checkout, run `npm run build` then
`npm run test:router-tarball`. The test installs actual tarballs, copies this
example from the installed package, and checks two-feature ownership, lazy refresh,
named URLs, gated replacement readiness, handled errors, late rejection and owner
teardown. Separate native tests run this same example in Chromium.
