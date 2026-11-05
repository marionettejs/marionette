# @mnjs/router

Optional routing tools for Marionette v5: named URLs and native navigation,
feature-owned registrations, and selectable child Applications. Use the tools
individually. A Router does not infer UI ownership from URL nesting.

This development package is **private**. Use locally built matching packages;
`marionette` is its exact-version peer. [Source rights/provenance](PROVENANCE.md)
remain a release gate. [Advanced contracts](DESIGN.md) describe the full API.

## Start with a Router and an ordinary handler

```js
import { Application, View } from 'marionette';
import { Router } from '@mnjs/router';

const frame = new Application({ region: '#content' });
const router = frame.addChildApp('navigation', new Router({
  routes: { item: { path: '/items/:id' } },
  handler(match, { signal }) {
    signal.throwIfAborted();
    const element = document.createElement('h1');
    element.textContent = `Item ${match.params.id}`;
    frame.showView(new View({ el: element }));
  },
}));
router.on('route:error', (error, match) => console.error(match?.name, error));
await frame.start();
await router.start();                         // routing enabled
const initial = await router.getInitialDispatch(); // first route outcome
await router.navigate('item', { id: '42' }).finished;
frame.destroy();                              // destroys its Router too
```

Provide `#content`. For data-backed pages, return/await required work in the
handler, pass its signal to requests, and check the signal again before effects
after an await. Cancellation does not undo UI or arbitrary work already performed.
Notification hooks are synchronous; returned promises are not awaited.

`url('item', { id: '42' })` builds a checked named URL. Paths support static text,
named parameters and optional brace groups; there are no splats, inline regex or
repeated parameters. See the [grammar](DESIGN.md#route-definitions-and-matching).
Redirects use ordinary routes; relative string targets resolve against the
redirect's navigation URL, consistently for sync and async callbacks.

## Check capabilities before eager application imports

The package is import-safe, but constructing a Router compiles route patterns.
If `app.js` constructs one at module scope, check before importing `app.js`:

```js
const required = {
  URLPattern: typeof globalThis.URLPattern === 'function',
  navigation: Boolean(globalThis.navigation),
  abortSignalAny: typeof globalThis.AbortSignal?.any === 'function',
  promiseWithResolvers: typeof Promise.withResolvers === 'function',
  urlCanParse: typeof globalThis.URL?.canParse === 'function',
};
if (Object.values(required).every(Boolean)) {
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
The [executable bootstrap](examples/desk/bootstrap.mjs) tests the
pre-import gate, including a deliberately eager router module.

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
commit-time choice or `route:ready` for returned-work completion; `route:error` may
have a null Match if planning failed. Same-URL refresh emits routing notifications
as well. `focusReset` and `scroll` independently accept `manual` or
`after-transition`; refresh uses manual policy. The package does not close overlays
or decide whether a departing overlay should restore focus.

## Add only the composition tools you need

- **Router alone:** routes plus one handler, or explicit `mount` with a controller.
- **RouteApplication:** optional feature-owned definitions on the shared Router.
  Constructing registers without starting the feature. Stop/restart retain routes;
  destruction unmounts and cancels that registration's work. `routeParent` supplies
  a named URL prefix. `withRouter(router)` configures ordinary declarative children.
- **ChildAppSwitcher:** optional selectable child group, also useful without routing.
  Register/start the group, then `switchTo(name, { key, options, signal })`.
  Structural keys are snapshotted before lifecycle callbacks. Use small primitive,
  array or plain-data keys; holes differ from undefined, and cycles/unsupported
  objects are rejected. See the [key contract](DESIGN.md#child-applications).
  Equal keys reuse/join the same child; running Applications ignore new start options.
  Changed keys or `reconstruct: true` stop/start that **same instance**. Replace its
  owner registration explicitly when a genuinely new instance is required.

These classes belong to Marionette's default Application family. An isolated
`createMarionette()` tree cannot register them as children; `.extend()` does not
change runtime identity. UI ownership/Regions remain ordinary Marionette choices.
There is no automatic branch walker, History API fallback, leave guard or history
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
