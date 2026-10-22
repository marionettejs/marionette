# @mnjs/router

Named, nested routing and child-Application switching for Marionette v5. Router
and ChildAppSwitcher are Applications: they support `.extend()`, options,
`initialize`, preparation, retained restart and registered-child ownership. Match
is plain data; navigation completion remains an explicit operation.

This development package is private. Install the matching `marionette` peer;
[source provenance and publication limits](PROVENANCE.md) remain separate from
[the API and design](DESIGN.md).

```js
import { Application } from 'marionette';
import { Router, ChildAppSwitcher } from '@mnjs/router';

const CatalogRouter = Router.extend({
  routes: [{ name: 'item', path: '/items/:id' }],
  handler(match, { signal }) {
    return catalog.showItem(match.params.id, { signal });
  },
  onRouteReady(match) {
    console.log('Ready:', match.name);
  },
});

const frame = new Application();
const router = frame.addChildApp('router', new CatalogRouter());
router.on('route:error', (error, match) => {
  console.error('Route failed:', match?.name, error);
});
await frame.start();
await router.start(); // Application activation; initial route work may still be pending
await router.navigate('item', { id: '42' }).finished;
frame.stop();       // also stops routing and registered descendants
frame.destroy();    // also destroys the Router
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

`start()` follows the ordinary Application contract: it awaits your `prepareStart`
and activates. Router adds no preparation or stop override, so a subclass can
define `prepareStart` without calling a Router setup method. Preparation and
synchronous startup callback failures reject `start()`.

Activation enables routing and dispatches the current URL asynchronously.
`start()` does not wait for that route. Observe `route:ready` for successful route
completion and subscribe to `route:error` before starting. Initial route failure
leaves routing enabled; use `refresh()` to retry. Unclaimed or canceled routes
do not emit `route:ready`. `restart()` retains routing and child identities without
redispatch; `refresh()` explicitly handles the current URL again.

`navigate()` returns `{ committed, finished }` immediately; await `.finished` for
handler/redirect readiness. Supersession/cancellation yields false; current failure
rejects. Events `route`, `route:ready` and `route:error` use `triggerMethod` and
correspond to `onRoute`, `onRouteReady` and `onRouteError`. Hooks are synchronous
notifications; returned Promises are not awaited. Keep required work in `handler`.
The error notification covers current routing failures; its Match is absent when
failure occurs before a Match is committed.

Ordinary intercepted navigations use native focus and scroll after returned
handler work finishes. `navigate()` accepts independent `focusReset` and `scroll`
options (`'manual'` or `'after-transition'`); redirects inherit the operation's
snapshot. Invalid values throw a synchronous TypeError before navigation starts.
Query changes do not imply preservation. `refresh()` re-dispatches the
current URL with manual focus/scroll and replacement history. Return/await child activation and UI work that
must precede completion. A synchronous `route:ready` listener may focus the new
content; actual focus changes during navigation are respected by the browser.
Direct initial dispatch does not trigger native focus/scroll, while its redirect
hops do. Initial fragments can precede asynchronously rendered content; applications
own any required positioning once that content exists. Views still own application-specific pane and focus policy;
the Router adds no custom scroll restoration machinery.


`ChildAppSwitcher` is an optional Application that owns one selectable group of
page Applications. Register it in the app tree, register its pages beneath it,
and explicitly start the group before selecting. Independent sidebars belong
outside that group.

```js
const pages = workspace.addChildApp('content', new ChildAppSwitcher());
pages.addChildApp('item', new ItemApplication());
await pages.start();

// Inside an awaited route handler:
const page = await pages.switchTo('item', {
  key: { id }, options: { id, region }, signal: match.signal,
});
if (!page || match.signal.aborted) return;
return page.showDetails(match);
```

Same name, instance and key reuse the child, joining pending preparation. A changed
key, or `reconstruct: true`, stops/starts that same registered instance and rebuilds
its UI. A running child ignores new start options; update it explicitly or request
reconstruction when its host changes. `pages.clear()` stops the selection while
keeping the group enabled; `pages.stop()` disables the group and stops all its
children; destruction destroys them. `Application.restart()` retains active UI
and children while repeating preparation.

Check the route signal after lazy imports or other awaits, before calling
`switchTo`. Passing `signal` suppresses an obsolete result without stopping shared
child preparation, so a newer same-key route can join it. See the complete
[ownership examples](DESIGN.md#child-applications).

Both classes belong to Marionette's default Application family. Use the named
`Application`, `Region` and View exports for their owned tree. `.extend()` and
Radio/State configuration do not move a class into an isolated `createMarionette()`
family; runtime-bound constructor factories are not part of this package.

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
