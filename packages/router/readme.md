# @mnjs/router

Optional routing tools for Marionette v5: named URLs and native navigation,
feature-owned registrations, and selectable child Applications. Use the tools
individually. A Router does not infer UI ownership from URL nesting.

**Browser support: tested on Chromium only. Firefox and WebKit are untested.**
Router requires **URLPattern**, `AbortSignal.any`, `Promise.withResolvers` and
`URL.canParse`; the default driver additionally requires the **Navigation API**.
An explicit `historyDriver()` uses the History API instead. Transpilation
does not supply these APIs. There is no automatic driver selection. Capability
presence alone does not establish browser compatibility. See the capability
check below before importing an application that eagerly constructs a Router.

Programmatic History-driver navigation accepts HTTP(S) destinations only.
Other schemes reject with `NotSupportedError` before document handoff. Ordinary
mailto, tel and other non-HTTP anchor links stay browser-owned.

For the public 0.1.0 release, use Node 24.15 or newer and install the package with
a compatible Marionette peer (minimum 5.0.1):

```sh
npm install @mnjs/router "marionette@^5.0.1"
```

The declared peer range is `^5.0.1`; current installed/browser evidence uses 5.0.1,
not future 5.x versions. The npm command assumes a published version; a candidate checkout or archive does
not establish registry availability. Routing is optional for Marionette 5.
[Advanced contracts](DESIGN.md) describe the full API. [Source and license](PROVENANCE.md)
identify the maintained source and unchanged [MIT notice](license.txt).
Report suspected vulnerabilities privately through the
[repository security advisory form](https://github.com/marionettejs/marionette/security/advisories/new).

## Build a routed feature with Applications and Views

A feature declares the URL portion it owns and the children that handle deeper
portions. Mounts select and start those children before their local handlers run.
Data loading belongs in Application preparation, not a second loader in each handler.
The [complete Catalog example](examples/catalog/README.md) uses this structure:

```js
import { Application } from 'marionette';
import { Router } from '@mnjs/router';
import { Catalog } from './examples/catalog/catalog.mjs';

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
await catalog.start(); // start the root owner before route dispatch
await router.start();
const initial = await router.getInitialDispatch();
if (initial.status === 'failed') {
  frame.destroy();
  throw initial.error;
}
await router.navigate('catalog:item', { id: '42' }).finished;
// Later, frame.destroy() tears down routing, children and displayed Views.
```

Provide `#content` and copy the shipped example folder alongside this bootstrap.
It uses named Views with function templates, Regions and optional Lit integration:
install `@mnjs/adapters@5.0.1` and `lit-html@3.3.3`. Lit expressions escape fetched
titles; the router has no renderer dependency. Plain model data needs no data adapter.

Catalog's class-level routes contain `/catalog` as its own page and
`/catalog/:id` as a mount of its declared Item child. Item owns `prepareStart`,
its View and local item/reviews routes. Moving between those leaves retains the
same item. Changing `id` stops and starts the same registered Item instance.
Returning to Catalog's own page stops its selected mounted child. Independent
panes remain ordinary children with their own Regions; URL ancestry alone does
not make them exclusive.

Registration is explicit: `mountRoutes(router, { parent? })` returns an unmount
function, binds this Application as controller/owner and does not start it.
Start each independently registered root before dispatch; mounted descendants
start through branch selection. Mounting before start is supported. Omitting root
activation can still call a leaf handler while child selection does nothing;
`route:ready` only certifies returned work, not that setup was performed.
Stop retains routes; destroy unmounts them. After owner stop/start, explicitly
start its required roots and Router again.

`routeTable(Catalog)` compiles declarations without constructing Applications.
Class-level `routes` and `childApps` are data, not factories. Non-undefined constructor
`routes` throw before Application initialization; undefined is equivalent to omission.
Constructor child registrations do not redefine the compiled
class route topology. `mountRoutes` also accepts routes/children assigned as
instance properties before compilation. There is one matcher and one browser
Router, not a router per child. Ordinary `router.mount(routes, { owner, controller })`
and a Router-level handler remain lower-level options.

Hashes are keyed by paths; names are explicit values. Hash values must be plain
objects (including null-prototype objects), not string shorthands or arrays.
Arrays of definitions use `{ path, name }`.
Leaf entries are `{ name, handler?, meta?, redirect? }`; mount entries are
`{ mount, namespace?, region?, meta? }`. Namespaces prefix descendant names with
colons. A mount key contains only that node's own parameters, not all descendants.
`childRouteOptions(match, mount)` supplies extra start options;
`getMountRegion(region)` chooses the Region. Required start and handler work is
returned through `routeBranch`; notifications remain synchronous.

Each owner may mount a registered child name only once. For two placements of the
same class, declare two child registrations with distinct names. A different path,
namespace or Region does not create a separate child identity; duplicate mounts
are rejected during compilation. Selection keys still contain only own mount params.

Named navigation inherits omitted parameters only from route nodes shared by
current and target branches. Equal parameter names on unrelated nodes do not
establish identity. Explicit null, undefined or empty values clear a parameter.
Named redirects use `{ name, params?, query?, hash? }` and forward omitted source
params/query/hash. Explicit parameter keys override or clear forwarded values; an explicit query replaces it. String redirects must
be URLs starting with `/`, `?`, `#` or `scheme://`; bare route names are rejected.
Relative query/fragment URLs resolve against the captured redirect URL for both
sync and async callbacks. Route names beginning `/` or `scheme://` are
reserved for URL navigation.

`owns(url)` optionally limits same-origin routing. `notFound: 'missing'` dispatches
that fallback name for an unmatched URL, retaining that URL and deepest-prefix
params. **Without `owns`, notFound claims every same-origin URL**, including paths
normally served by the server. Exclude those paths explicitly. A not-found Match
does not acquire the target route's URL ancestry: pass `match.params` explicitly
when generating a link that needs those prefix values.

## Check capabilities before eager application imports

The package is import-safe, but constructing a Router compiles route patterns.
For the default native driver, if `app.js` constructs one at module scope,
check before importing `app.js`:

```js
if (
  typeof globalThis.URLPattern === 'function' &&
  Boolean(globalThis.navigation) &&
  typeof globalThis.AbortSignal?.any === 'function' &&
  typeof Promise.withResolvers === 'function' &&
  typeof globalThis.URL?.canParse === 'function'
) {
  const { start } = await import('./app.js');
  await start();
} else {
  // The host application chooses its supported-environment response.
}
```

The default driver needs the Navigation API. `URLPattern` is needed for route
compilation; `AbortSignal.any` for route signals; `Promise.withResolvers` for
Application/routing operations; `URL.canParse` for `match(string)`. Tests can inject
`memoryDriver({ url: 'https://example.test/' })` instead of the native driver;
that removes the Navigation API dependency, not the remaining Router requirements.
A route-less `RouteApplication` used only for selection does not need URLPattern or navigation. Transpilation
supplies none of these Web APIs. Capability presence is not browser certification.
The installed-consumer check executes this exact recipe with a deliberately
eager application module, checking that missing capabilities prevent its import.

Initial native-browser certification targets Chromium with those capabilities.
Standalone routing was verified on Chromium 154; consumer integration also has
reported Chromium 151 evidence. Receipts identify the exact tested build and
archive. Firefox and WebKit are untested and are not certified targets. There is no
automatic fallback driver. These browser requirements are independent of the
core library's transpilation targets. Node consumer evidence currently uses
Node 24.19.0; the declared minimum is 24.15.0.

## Choose a History API driver explicitly

`historyDriver()` has the same named-factory format as `memoryDriver()` and
`navigationDriver()`. Driver injection and the native default are unchanged.
Application code owns choosing and importing a driver; the package has no loader.
If URLPattern is absent, install a consumer polyfill before constructing Router:

```sh
npm install urlpattern-polyfill
```

This is a driver configuration fragment, using the same Router and routes:

```js
import 'urlpattern-polyfill';
import { Router, historyDriver } from '@mnjs/router';

const router = new Router({
  driver: historyDriver(),
  routes: {
    '/': { name: 'home' },
  },
});
```

History and memory drivers also require `structuredClone`. The History adapter
tracks only its dense known-entry window, not arbitrary prior browser history;
document reloads and unknown entries reset that window. Ordinary fragment
navigation can also reset this instance-local window; it does not erase actual
browser history. Intercepted ordinary same-URL anchor clicks can push duplicate
entries, whereas programmatic `history: 'auto'` replaces the current entry when
the URL is unchanged. Browser Back/Forward is already
committed and cannot be vetoed. It preserves caller state using reserved entry
metadata, leaves unclaimed links/document navigation to the browser, and does
not emulate native focus/scroll restoration. See the [precise boundary](DESIGN.md#history-api-driver).
Same-target live traversal calls join; a different helper destination rejects
while that request awaits commitment. A push/replace cancels that local request
and permits another helper call. An interfering browser arrival cancels a live
request if it reaches a different key; the actual location still dispatches.
This adapter does not promise Navigation API traversal parity.
Direct non-current Driver traversal requires an active `navigate` subscription;
Router maintains one while routing runs. Detached calls reject with
`InvalidStateError`; current-entry no-ops remain usable.

Optimized ESM consumers can remove unused drivers; installed-package checks build
and execute driver-only and Router combinations. A referenced fallback can remain
in a shared bundle. Named exports do not promise a separately downloaded chunk:
conditional imports and network splitting belong to the application's bundler.
The History path is tested in Chromium with the Navigation API unused and an
actual URLPattern polyfill. This is not full polyfill certification:
`urlpattern-polyfill@10.1.0` differs from native URLPattern for `__proto__`
parameter names and backslash syntax; avoid those inputs on that path. See
[the compatibility limits](DESIGN.md#history-api-driver). Firefox and WebKit
remain untested.

## Choose which completion you need

| Observation | Meaning |
| --- | --- |
| `await router.start()` | Ordinary Application activation; first route work may still be pending. |
| `getInitialDispatch()` | Latest routing session's first matched/unmatched/cancelled/failed outcome; null before activation, never rejects. |
| `navigate(...).committed` | Driver commit outcome, following redirect outcomes. |
| `route(match)` | Router Match committed, before its awaited handler. |
| `navigate(...).finished`, `refresh()`, `back()` | Returned handler/redirect work completed while current; true, false on cancellation, rejection on current operational failure. |
| `route:ready` | Handler fulfilled and Match remains current. A fulfilled false or handled error presentation may still be successful. |

Router cancellation settles completion promptly even when ignored work continues.
It does not discover detached work or wait for every feature-owned replacement.
A page that restarts itself before its first presentation needs its **own stable
initial-presentation promise**. The [distinct desk consumer](examples/desk/README.md)
shows this with actual Applications, attached loading/content/error views,
replacement work, late failures and owner teardown. A local refresh after first
presentation has a separate operation promise; initial readiness is not perpetual.

A switch caller's signal only limits that caller's result; aborting it deliberately
does not cancel shared child preparation. The aborted caller promptly fulfills
undefined while preparation continues. Current activation failures reject;
superseded results do not regain authority. Do not equate every undefined selector
result or fulfilled false Application result with cancellation of all underlying work.

Overlay dismissal and focus are application policies. Subscribe to `route` for a
commit-time choice or `route:ready` for returned-work completion;
`route:error(error, match, { info })` may have a null Match if planning failed.
Its info is the originating navigation's value, also through redirects; initial
dispatch and refresh supply undefined. Existing two-argument listeners still work,
and promise failures retain the original error. Applications choose how to coordinate
both observation paths; driver/setup failures can occur without a route event.
If synchronous Driver setup rejects `start()`, Router cancels its partial binding
without stopping the Application or its children. Application remains activated
with routing disabled. Use `restart()` to retry, or explicit stop/start; `start()`
alone on an active Application does not retry. Use `stop()` or `destroy()` when
abandoning that activation. The original failure is preserved.
Same-URL refresh emits routing notifications
as well. `focusReset` and `scroll` independently accept `manual` or
`after-transition`; refresh uses manual policy. The package does not close overlays
or decide whether a departing overlay should restore focus.

## Selection without routing

A route-less `RouteApplication` can select ordinary Application children through
`switchTo(name, { key, options, signal, restart })`, `clear()` and `getCurrent()`.
Start the owner first. There is one selection group per owner. Same-key calls join
one outcome and share startup failure. Changed keys or per-call `restart: true`
stop/start the registered instance; they do not construct a replacement. Running
Applications ignore new start options. Replace a child registration explicitly
when a new instance is required. `clear()` is idempotent and returns nothing.

Keys are primitives (undefined, null, string, number or boolean) or flat records
of those values. Own enumerable string fields are snapshotted before lifecycle
callbacks, so later mutation cannot relabel an active child. Comparison uses
`Object.is`; missing fields differ from undefined. Nested objects, arrays and
other value types are rejected. Use small identity records, not application state
trees. Caller signals suppress only that caller's result and do not cancel shared
Application preparation. Stop/destroy still cancel owned lifecycle work.
Optional `onCleanupError(error, child)` observes a secondary cleanup failure after
failed startup; the primary startup error wins. Without the hook that secondary
failure is discarded. Synchronous normal stop failures are not rolled back.

`handleRouteError(error, match, { mount, phase })` handles a branch failure locally;
phase is `start` or `route`. Rethrowing bubbles to the parent branch and ultimately
Router's `route:error`. Resolving is an explicitly handled result. Cancellation
suppresses stale branch errors. The package does not choose an error screen or
reporting policy.

Router and RouteApplication belong to Marionette's default Application family.
An isolated `createMarionette()` tree cannot register them as children. No global
Radio bridge, service locator, leave guard or history compensation is installed.
See [contracts](DESIGN.md), [feature registration](DESIGN.md#feature-route-registration),
[selection](DESIGN.md#child-applications) and [types](DESIGN.md#typing-and-javascript).

`canGoBack()` checks the preceding entry's router marker. A matched initial entry
is marked too. `back()` awaits its route readiness when eligible; it does not
restrict browser Back or guarantee staying within the app/document.

From a built checkout, `npm run test:router-tarball` installs actual archives and
checks ESM/CJS, declarations, tree shaking, cancellation, the bootstrap recipe and
shipped examples. Memory/JSDOM checks do not certify browser history or focus.
