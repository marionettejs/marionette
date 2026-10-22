# @mnjs/router

Named, nested routing and child-Application switching for Marionette v5. Router
and ChildAppSwitcher are MnObjects: they support `.extend()`, options,
`initialize`, synchronous event hooks and explicit destruction. Match is plain data.

This development package is private. Install the matching `marionette` peer;
[source provenance and publication limits](PROVENANCE.md) remain separate from
[the API and design](DESIGN.md).

```js
import { Router } from '@mnjs/router';

const CatalogRouter = Router.extend({
  routes: [{ name: 'item', path: '/items/:id' }],
  handler(match, { signal }) {
    return catalog.showItem(match.params.id, { signal });
  },
  onRouteReady(match) {
    console.log('Ready:', match.name);
  },
});

const router = new CatalogRouter();
await router.start();
await router.navigate('item', { id: '42' }).finished;
router.stop();       // pause navigation; keep the object and subscriptions
router.destroy();    // terminal cleanup
```

Paths support static text, named parameters, optional brace groups (`/items{/:id}?`)
and literal escapes. Inline regex, wildcard and repeated parameters are rejected.
See the [pathname grammar](DESIGN.md#route-definitions-and-matching) for the exact
subset and URL-generation rules.

Old bookmarks use ordinary named routes with synchronous or asynchronous
`redirect` callbacks. Fetch missing target data in the application and forward
query/hash explicitly. See [bookmark migration](DESIGN.md#old-bookmarks-and-renamed-features).

The default Driver uses the active document's Navigation API. Inject
`memoryDriver({ url })` with an explicit absolute initial URL for deterministic
tests. Its optional `activation: { navigationType: 'reload' }` simulates how the
document was entered. Initial routing reads the native document activation type
(or uses `push` when the Driver supplies none); later navigations use their event type.
Drivers and Match are not coupled to rendering, models, services, Regions
or application policy.

`match('/items/42')` resolves against the Driver's current URL, including before
`start()`, without subscribing or navigating. Outside a browser, provide that Driver
or pass an absolute URL to `match()`. Absolute matching and `url()` generation need
no Driver. There is no library-defined fallback origin.

`navigate()` returns `{ committed, finished }` immediately; await `.finished` for
handler/redirect readiness. Supersession/cancellation yields false; current failure
rejects. Events `route`, `route:ready` and `route:error` use `triggerMethod` and
correspond to `onRoute`, `onRouteReady` and `onRouteError`. Hooks are synchronous
notifications; returned Promises are not awaited. Keep required work in `handler`.

Ordinary intercepted navigations use native focus and scroll after returned
handler work finishes. `navigate()` accepts independent `focusReset` and `scroll`
options (`'manual'` or `'after-transition'`); redirects inherit the operation's
snapshot. Query changes do not imply preservation. `refresh()` re-dispatches the
current URL with manual focus/scroll and replacement history. Return/await child activation and UI work that
must precede completion. A synchronous `route:ready` listener may focus the new
content; actual focus changes during navigation are respected by the browser.
Direct initial dispatch does not trigger native focus/scroll, while its redirect
hops do. Initial fragments can precede asynchronously rendered content; applications
own any required positioning once that content exists. Views still own application-specific pane and focus policy;
the Router adds no custom scroll restoration machinery.


`ChildAppSwitcher` is optional composition for applications with independently
managed children. It switches registered child Applications; Views/Regions retain
rendering and focus. It imposes no router Application base class.

```js
const page = await pages.switchTo('item', {
  key: { id }, options: { id, region },
});
if (!page || match.signal.aborted) return;
return page.showDetails(match);
```

Same name, instance and key reuse the child. A changed key, or `reconstruct: true`,
stops/starts that same registered instance and rebuilds its UI.
`Application.restart()` instead retains active UI while repeating preparation.
The complete ownership example and isolated-runtime configuration are in
[DESIGN.md](DESIGN.md).

The native Driver requires Navigation API, URLPattern and AbortSignal.any.
Marionette Application readiness uses Promise.withResolvers. Node **24.15+**
provides URLPattern for memory-driver use; the source toolchain is pinned by the
repository release profile. There is no bundled polyfill or History API fallback.

From the repository root:

```sh
npm test -- test/unit/router
npm run build
npm run test:router-package
```

Tests use public package imports. Build checks ESM/CJS declarations; package
fixtures exercise the required peer, lifecycle and switching in both formats.
Native-browser behavior and real UI focus/scroll require separate validation.
