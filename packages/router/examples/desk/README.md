# A desk with independently owned features

Desk is an ordinary Application with one Router, an eager Catalog root in its main
Region and a tools owner in its sidebar Region. A lazy Activity root belongs to
tools. Both register beneath the named desk URL prefix; URL ancestry does not
choose exclusive UI ownership or stop unrelated panes.

Copy this folder into an ESM application with the router/Marionette peer plus
`@mnjs/adapters` whose core peer range includes the installed Marionette version,
and `lit-html@3.3.3`.
PresentationView uses a function template and Lit DOM adapter; loaded content
and error messages remain escaped text.
Provide #main and #side:

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
router.on('route:error', (error, match) => console.error(match?.name, error));
await desk.start(); // prepares its eager Catalog root
await router.start();
const initial = await router.getInitialDispatch();
if (initial.status === 'failed') {
  desk.destroy();
  throw initial.error;
}
const activity = tools.addChildApp('activity', new Activity({ region: tools.getRegion() }));
activity.mountRoutes(router, { parent: 'desk' });
await tools.start();
await activity.start(); // root must be active before branch dispatch
await router.refresh(); // handles an existing /:desk/activity deep link
await router.navigate('item', { desk: 'blue', id: 'one' }).finished;
// Later, desk.stop() or desk.destroy() follows normal Application ownership.
```

Use the [pre-import capability recipe](../../readme.md#check-capabilities-before-eager-application-imports)
where application modules eagerly construct Router. The application chooses its
Driver and unsupported-environment response. A memory driver removes the native
Navigation requirement only.

Activity declares a mounted panel. Its local leaf shows a View after ordinary
selection/start. Catalog explicitly clears that independent panel when product
policy closes the sidebar; it does not activate an area merely to clean it up.
Catalog's own page selection includes desk/id as its explicit identity. Neither
feature needs to enumerate the other's descendant routes. Activity.clear() keeps
its root/registration ready for later dispatch. Destroying Activity unmounts it;
recreation uses ordinary tools.addChildApp, mountRoutes and start, followed by refresh.

The Catalog page also demonstrates a separate, advanced first-presentation contract.
If page.restart({ id, load }) replaces its startup before first readiness, the
original Application start fulfills false while a stable presentation promise
remains pending until replacement content or a handled error View attaches.
The route returns that required presentation work. A stop settles it as stopped;
late work remains observed and checks its lifecycle signal before effects. After
first presentation a local refresh has its own restart promise; it does not reopen
initial readiness. Fulfilled false is not universally cancellation, and the router
does not discover detached replacements. The simpler [Catalog example](../catalog/README.md)
uses ordinary mounted preparation without this special policy.

Stop/restart retain feature registrations. Parent stop/destroy ends routing and
owned UI; after a full stop/start explicitly start its required roots/Router again.
The bare /:desk route redirects to that desk's Catalog index, retiring old item and
sidebar content. Start activates normal Applications, not an example facade.

From a built checkout, npm run test:router-tarball executes the actual shipped
example with gated replacement readiness, escaped rendering, handled errors,
lazy registration, named URLs, independent regions and teardown. The
[three-engine installed-archive suite](../../readme.md#browser-validation)
also exercises these modules in Chromium, Firefox and Playwright WebKit.
