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

This UI example chooses Lit for escaped text interpolation. Install its optional
consumer dependencies; the router itself requires neither:

```sh
npm install @mnjs/adapters@5.0.1 lit-html@3.3.3
```

```js
import { Application, View } from 'marionette';
import { Router, RouteApplication } from '@mnjs/router';
import LitDomApi from '@mnjs/adapters/dom/lit-html';
import { html } from 'lit-html';

const ItemView = View.extend({
  template: ({ id }) => html`<h1>Item ${id}</h1>`,
}).setDomApi(LitDomApi);

const Catalog = RouteApplication.extend({
  region: { el: '#content' },
  routes: {
    item: { path: '/items/:id', handler: 'showItem' },
  },
  showItem(match) {
    match.signal.throwIfAborted();
    this.showView(new ItemView({ model: { id: match.params.id } }));
  },
});

const frame = new Application();
const router = frame.addChildApp('navigation', new Router());
const catalog = frame.addChildApp('catalog', new Catalog({ router }));
router.on('route:error', (error, match) => console.error(match?.name, error));
await frame.start();
await catalog.start();                        // this static feature is ready
await router.start();                         // routing enabled
const initial = await router.getInitialDispatch(); // first route outcome
await router.navigate('item', { id: '42' }).finished;
// Later, frame.destroy() destroys its Router, Catalog and displayed View.
```

Provide `#content`. The frame owns its shared Router and Catalog. Catalog owns
its route definitions, handler, Region and displayed View. RouteApplication is an
ordinary Application that registers those definitions at construction; navigation
invokes its handler, whose returned work controls route readiness. This static
feature is explicitly started before routing. Registration alone does not start
it: omitting activation still dispatches handlers, but skips `prepareStart` and
`onStart`. Stopping it retains its registration; destroying it retires the routes.
After an owner stop/start, explicitly start its required children again. The
Router does not infer UI ownership from URL nesting.

The named View supplies a function template to Marionette's
default renderer; `setDomApi(LitDomApi)` handles its Lit output for this View.
Plain model data needs no data adapter. Lit child expressions keep the ID as text,
including HTML-like characters. A static default template can simply be a function
returning trusted HTML; dynamic string HTML needs a safe templating integration.
No global renderer override is needed here. For data-backed pages, return/await
required lifecycle work from the feature handler. The
[data-backed Catalog](examples/catalog/README.md) loads in `prepareStart`, presents
in synchronous `onStart`, and returns `restart()` from its route method. It
deliberately reloads each dispatch rather than pretending that `start({ id })`
reloads an active Application. Lifecycle and route signals have different
lifetimes. Cancellation does not undo UI or arbitrary work already performed.
Notification hooks are synchronous; returned promises are not awaited.

RouteApplication is optional. An ordinary feature Application can register its
route data through `router.mount(routes, { owner, controller })`. A local
`routeTo(match)` method returns that feature's required lifecycle work. The
[ordinary Catalog example](examples/catalog/README.md) uses an ordinary feature
Application, area metadata and one such boundary, without a layer of per-route
forwarders. Destruction retires its registration; stop/restart retain it.
A Router-level handler remains a lower-level option for small integrations.
Another area's handler explicitly stops or clears the content it leaves, without
activating an area just to clean it up. Use optional RouteApplication when a feature
independently owns its declarative registration.

`url('item', { id: '42' })` builds a checked named URL. Paths support static text,
named parameters and optional brace groups; there are no splats, inline regex or
repeated parameters. See the [grammar](DESIGN.md#route-definitions-and-matching).
Redirects use ordinary routes; relative string targets resolve against the
redirect's navigation URL, consistently for sync and async callbacks.
Named redirects accept `{ name, params?, query?, hash? }`; forwarding is explicit,
for example `{ name: 'item', params: match.params, query: match.query, hash: match.url.hash }`.
Configured `persistParams` keys come from the redirecting match for both sync and
async targets, including initial dispatch. Explicit params override or clear them;
ordinary `router.url()` still persists from the current committed match.
Omitted query/hash do not inherit from the source. `hash` follows `URL.hash`
semantics, including optional leading `#`, empty string and explicit empty `#`.
Route names cannot start with `/` or `scheme://`; those spellings select raw URL
navigation and are rejected as names at registration.

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
`ChildAppSwitcher` alone does not need URLPattern or navigation. Transpilation
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
    home: { path: '/' },
  },
});
```

History and memory drivers also require `structuredClone`. The History adapter
tracks only its dense known-entry window, not arbitrary prior browser history;
document reloads and unknown entries reset that window. Browser Back/Forward is already
committed and cannot be vetoed. It preserves caller state using reserved entry
metadata, leaves unclaimed links/document navigation to the browser, and does
not emulate native focus/scroll restoration. See the [precise boundary](DESIGN.md#history-api-driver).
Same-target live traversal calls join; a different helper destination rejects
while that request awaits commitment. A push/replace cancels that local request
and permits another helper call. An interfering browser arrival cancels a live
request if it reaches a different key; the actual location still dispatches.
This adapter does not promise Navigation API traversal parity.

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
does not cancel shared child preparation. Current activation failures reject;
superseded results do not regain authority. Do not equate every undefined selector
result or fulfilled false Application result with cancellation of all underlying work.

Overlay dismissal and focus are application policies. Subscribe to `route` for a
commit-time choice or `route:ready` for returned-work completion;
`route:error(error, match, { info })` may have a null Match if planning failed.
Its info is the originating navigation's value, also through redirects; initial
dispatch and refresh supply undefined. Existing two-argument listeners still work,
and promise failures retain the original error. Applications choose how to coordinate
both observation paths; driver/setup failures can occur without a route event.
Same-URL refresh emits routing notifications
as well. `focusReset` and `scroll` independently accept `manual` or
`after-transition`; refresh uses manual policy. The package does not close overlays
or decide whether a departing overlay should restore focus.

## Add only the composition tools you need

- **Router alone:** routes plus one handler, or explicit `mount` with a controller.
- **RouteApplication:** optional feature-owned definitions on the shared Router.
  Constructing registers without starting the feature. Stop/restart retain routes;
  destruction unmounts and cancels that registration's work. `routeParent` supplies
  a named URL prefix. A known router can be a normal `.extend({ router })` default;
  `withRouter(router)` is an equivalent convenience.
- **ChildAppSwitcher:** optional selectable child group, also useful without routing.
  Register/start the group, then `switchTo(name, { key, options, signal })`.
  Structural keys are snapshotted before lifecycle callbacks. Use small primitive,
  array or plain-data keys; holes differ from undefined, and cycles/unsupported
  objects are rejected. See the [key contract](DESIGN.md#child-applications).
  Equal keys reuse/join the same child; running Applications ignore new start options.
  Changed keys or `reconstruct: true` stop/start that **same instance**. A class or
  constructor `reconstruct` default can suit rebuilt hosts; an explicit per-call
  `false` retains/joins the same-key child. Key, signal and child options stay
  per-call. Replace its owner registration explicitly when a genuinely new
  instance is required.

These classes belong to Marionette's default Application family. An isolated
`createMarionette()` tree cannot register them as children; `.extend()` does not
change runtime identity. UI ownership/Regions remain ordinary Marionette choices.
There is no automatic branch walker, driver selection, leave guard or history
compensation. Detailed [feature registration](DESIGN.md#feature-route-registration),
[selection](DESIGN.md#child-applications), [types](DESIGN.md#typing-and-javascript)
and [driver contracts](DESIGN.md#construction-options-and-extension) remain opt-in reading.

`canGoBack()` only checks the preceding entry's router marker. A matched initial
entry is marked too. `back()` awaits readiness when eligible and returns false
otherwise; it does not restrict the browser's Back button or guarantee staying
inside the app/document.

From a built checkout, `npm run test:router-tarball` packs and installs the actual
packages into an isolated consumer, then runs the basic ESM/CJS checks, cancellation
probes, capability bootstrap and the two-feature desk example. Native navigation
checks are separate; memory/JSDOM tests do not certify browser history or focus.
