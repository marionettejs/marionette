# @mnjs/router

Optional routing tools for Marionette v5: named URLs and native navigation,
feature-owned registrations, and selectable child Applications. Use the tools
individually. A Router does not infer UI ownership from URL nesting.

**Tested on Chromium, Firefox and Playwright WebKit.** The
[installed-archive browser run](https://github.com/marionettejs/marionette/actions/runs/43383924465/job/131748225100)
passed all 162 Router cases on each engine, including native Navigation API and
explicit History-driver routing. See [browser validation](#browser-validation)
for the archive and engine versions.
Router requires **URLPattern**, `AbortSignal.any`, `Promise.withResolvers` and
`URL.canParse`; the default driver additionally requires the **Navigation API**.
An explicit `historyDriver()` uses the History API instead. Transpilation
does not supply these APIs. There is no automatic driver selection. See the capability
check below before importing an application that eagerly constructs a Router.
The pinned WebKit engine has [known native differences](#known-native-webkit-differences).

Programmatic History-driver navigation accepts HTTP(S) destinations only.
Other schemes reject with `NotSupportedError` before document handoff. Ordinary
mailto, tel and other non-HTTP anchor links stay browser-owned.

Use Node 24.15 or newer and install the package with
a compatible Marionette peer (minimum 5.0.1):

```sh
npm install @mnjs/router "marionette@^5.0.1"
```

The declared peer range is `^5.0.1`. Routing is optional for Marionette 5 and
versioned independently of the coordinated core packages.
[Advanced contracts](DESIGN.md) describe the full API. [Source and license](PROVENANCE.md)
identify the maintained source and unchanged [MIT notice](license.txt).
Report suspected vulnerabilities privately through the
[repository security advisory form](https://github.com/marionettejs/marionette/security/advisories/new).

## Known native WebKit differences

The pinned Playwright WebKit build has two observed Navigation API differences.
The [observed release profile](https://github.com/marionettejs/marionette/blob/f6ff6833967d432c591151c9b64fce724ca98a8a/config/release-profile.json)
and each test receipt identify the tested versions; these observations do not
guarantee behavior of other builds. Router keeps the native driver's results and
event classification; it does not normalize them.

- Removing a fragment (`/page#top` or `/page#` to `/page`) reports
  `hashChange: true` with `destination.sameDocument: false`. The tested Chromium
  and Firefox builds report `hashChange: false`. The
  [HTML navigate-event algorithm](https://html.spec.whatwg.org/multipage/nav-history-apis.html#fire-navigate-event)
  requires a same-document destination for `hashChange: true`. This raw API test
  does not establish whether a Router-owned navigation dispatches a handler or
  replaces the document; those effects must not be inferred from the flag alone.
- In two overlapping Back scenarios, native `back().finished` rejects
  `AbortError` even though the destination handler has completed, `route:ready`
  has fired, and the current Match signal remains un-aborted. Router's `back()`
  consequently resolves `false`. This occurs when a second Back supersedes a
  still-preparing destination, and when an abort listener navigates before an
  already queued Back arrives. The `false` receipt in these cases does not mean
  that no destination became ready. Operational handler failures still reject;
  they are not converted into successful navigation.

The browser tests retain these cases and assert WebKit's exact observed results,
including current entry identity, signal state, readiness and error isolation.
Separate diagnostics retain the raw native receipts. The
[reproducer and CI evidence](https://github.com/marionettejs/marionette/actions/runs/43291118434)
show the original differences before the engine-specific expectations.

Applications needing different completion or fragment-routing behavior can
explicitly choose [the History driver](#choose-a-history-api-driver-explicitly)
before constructing the Router. It has its own documented limits and is not
selected automatically. Playwright WebKit coverage does not establish behavior
in every shipping Safari or iOS version.

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
It uses named Views with function templates, Regions and optional `@mnjs/html` integration:
install a compatible `@mnjs/html` version (verified with 1.0.0). HTML expressions escape fetched
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
supplies none of these Web APIs.
The installed-consumer check executes this exact recipe with a deliberately
eager application module, checking that missing capabilities prevent its import.

## Browser validation

The [passing installed-archive run](https://github.com/marionettejs/marionette/actions/runs/43383924465/job/131748225100)
tested Chromium 158.0.8127.18, Firefox 159.0 and Playwright WebKit 27.2 on
macOS arm64. All 162 inventory cases passed once on each engine, with no
failures, retries or skips. The Linux-produced Router 0.1.1 archive came from
[`ec981e0b`](https://github.com/marionettejs/marionette/commit/ec981e0ba43d14ea1a35695fe3b9b17ad271555d),
with SHA-256 `e7c45fbecd159aab6bfef6ce10e2bf7b928cc7509523446cc11313e1fd344cdd`.
Its runtime matches published Router 0.1.1. This README records the expanded
browser coverage, updating the Chromium-only statement in the published 0.1.1
README. The [known native WebKit differences](#known-native-webkit-differences)
remain part of the tested behavior.

The same revision also passed the source-checkout browser suite on Linux.
The installed archive was browser-tested on macOS; Linux installed-archive
browser coverage and actual bfcache restoration remain unverified.
These browser requirements are independent of core's transpilation targets.
The archive check used the published Marionette 5.0.1 minimum stack;
Node consumer evidence uses Node 24.19.0, with a declared minimum of 24.15.0.

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
and execute driver-only and Router combinations.

### Download History only when needed

Added in 0.2.0, the public `@mnjs/router/history` entry exports the named `historyDriver` factory
in ESM and CommonJS, with declarations for both. It has the same API and behavior
as the root factory. Existing root imports and the native default remain supported.
Applications using `^0.1.1` must update their dependency range to adopt 0.2.0;
see the [changelog](changelog.md). A candidate archive does not establish registry
availability.

A bundled application can import Router statically and load History only when
Navigation is absent, before starting the Router:

```js
import { Router } from '@mnjs/router';

// Supply any missing URLPattern/other required APIs before constructing Router.
const driver = globalThis.navigation
  ? undefined
  : (await import('@mnjs/router/history')).historyDriver();
const router = new Router({ driver, routes: { '/': { name: 'home' } } });
await router.start();
await router.getInitialDispatch();
```

Keep the fallback import on the public History entry. A dynamic wrapper that
imports `historyDriver` from the root can share the root's statically loaded
bundle and download History even when the wrapper is never requested. Neither
driver is selected automatically by the package. Capability detection alone does
not establish browser compatibility or supply other missing APIs.

Verify the final production graph: no History implementation or History-only
static dependency may appear in the native entry's static import closure. Identify
the emitted History chunk and its exclusive dependencies from the bundler's
manifest/module graph, rather than a guessed filename. Avoid grouping History
with eager dependencies through manual chunk rules, and exclude these lazy assets
from preload/prefetch rules and service-worker install precaching. Precaching all
JavaScript downloads History even on native browsers. Keep runtime script caching
so the fallback can be cached after its first requested use; excluding it from
precache also means first offline use requires an already cached copy.

This is a bundler code-splitting contract, verified by the installed production
consumer check. Direct unbundled root ESM imports still download the bundled
History implementation. Eager root `historyDriver` imports also retain it.
The History entry is independently compiled from the same source and has a
distinct factory identity from the root export; importing both factories can
retain two copies. Choose one import path for History in an application. The
package does not control network, preload or service-worker policy.

The existing three-engine matrix exercises the root History export with a throwing
Navigation API getter and an actual installed URLPattern polyfill. This is not full polyfill certification:
`urlpattern-polyfill@10.1.0` differs from native URLPattern for `__proto__`
parameter names and backslash syntax; avoid those inputs on that path. See
[the compatibility limits](DESIGN.md#history-api-driver). Passing receipts,
rather than capability detection, establish the observed engine coverage.

## Choose which completion you need

| Observation | Meaning |
| --- | --- |
| `await router.start()` | Ordinary Application activation; first route work may still be pending. |
| `getInitialDispatch()` | Latest routing session's first matched/unmatched/cancelled/failed outcome; null before activation, never rejects. |
| `navigate(...).committed` | Driver commit outcome, following redirect outcomes. |
| `route(match)` | Router Match committed, before its awaited handler. |
| `navigate(...).finished`, `refresh()`, `back()` | Returned handler/redirect work completed while current; true, false on cancellation, rejection on current operational failure. |
| `route:ready` | Handler fulfilled and Match remains current. A fulfilled false or handled error presentation may still be successful. |

The [native WebKit Back exception](#known-native-webkit-differences) qualifies
this completion contract: the helper can resolve `false` from the native receipt
despite completed returned work and a ready, current, un-aborted Match.

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

Prepare the example renderer separately with `npm run docs:prepare-html`, or
set `MNJS_HTML_TARBALL` to an existing HTML archive for an offline run. The verifier
does not fetch the renderer implicitly.

From a built checkout, `npm run test:router-tarball` installs actual archives and
checks ESM/CJS, declarations, tree shaking, cancellation, the bootstrap recipe and
shipped examples. Memory/JSDOM checks do not certify browser history or focus.
