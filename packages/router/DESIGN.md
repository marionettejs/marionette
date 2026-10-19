# Router design and integration

This is a private refinement of Claude's router package. See
[provenance](PROVENANCE.md) for exact source revisions and deliberate divergence.
It is a separate, opt-in package; Marionette core does not import or re-export it.

## Comparison with the earlier prototype

| Topic | Earlier `950e4c6` prototype | This branch's starting design |
| --- | --- | --- |
| Public surface | `createRoutes` / `createRouter` | `Router` and plain Match |
| Transport | Injected History API or memory history | Navigation API or memory Driver |
| Paths | Literal/named segments, first match | Nested tree, ranked URLPattern subset |
| Readiness result | String outcome records; handled is dispatch completion | Promise<boolean>; awaited handler determines readiness |
| Authority | signal, `isCurrent`, `runIfCurrent` | Match signal and explicit owner checks |
| Feature coordination | Host supplies it | Host or optional replaceable RouteOutlet |
| Lifetime | Terminal `dispose()` | Restartable Router `start()` / `stop()` |

The prototype's source reinforces explicit authority, foreign-state ownership and
transport separation. Its History driver, reflection and outcome vocabulary are
not folded into a second runtime path here. The shared safeguards are applied to
Claude's one package instead.

## Responsibilities and terminology

| Responsibility | Owner |
| --- | --- |
| Compile/rank nested routes, build named URLs, choose redirects | `Router` |
| Browser navigation/history event semantics | Injected `Driver` |
| Current route decision and cancellation authority | Plain `Match` with `signal` |
| Prepare a feature, own children, control start/stop readiness | Ordinary `Application` |
| Select one registered child Application by identity | Optional `RouteOutlet` |
| Render, place child Views, manage local DOM/focus/scroll | Views and Regions |
| Loading UI, errors, permissions, analytics, route-specific data | Application/host policy |

`RouteOutlet` is an Application selector, not a DOM slot or Region. Its name is
retained to keep this extraction focused. It neither reads a Match nor imposes a
`showRoute` protocol. An app can replace it completely or use Router alone. There
are no compulsory RouterApp/SubrouterApp classes and no parallel application
lifecycle. The outlet is a small complete coordinator for selection, reuse,
supersession and ownership; host activation remains explicit.

This follows Marionette's [architecture](../../docs/architecture.md),
[Application](../../docs/api/application.md), [MnObject](../../docs/api/mnobject.md)
and [routing guide](../../docs/guides/routing.md). `@mnjs/utils` supplies Events.
The `/outlet` entry alone imports Marionette. It supports `.extend()`, normal
initialization/destruction hooks and callable constructor delegation. Required
ownership setup cannot be skipped by overriding `initialize` or `onDestroy`.

## Route and navigation contract

Named and unnamed route nodes form a tree. Relative children append to a parent;
absolute paths start at the root. Named nodes match themselves; unnamed nodes
supply prefixes and inherited metadata. Route names and parameter names within a
branch are unique. Metadata merges root to leaf, and branch entries retain their
own metadata and parameters.

Paths use a supported URLPattern pathname subset: static segments, named and
unnamed parameters, regular-expression constraints, optional groups, and wildcard
or repeated parameters. The package's tokenizer builds URLs and ranks candidates;
it is not a promise to support every URLPattern grammar form (for example quoted
or arbitrary Unicode parameter names). Ranking compares segments: static,
parameter, optional, wildcard; ties use definition order. Query values are exposed
as URLSearchParams. Matching decodes parameters; generation encodes them. Trailing
slashes normalize away except at `/`. Generation rejects missing/invalid values,
dot segments, static-route collisions and parameter values that would change
under matching/normalization. Mount/unmount changes the table without navigation;
call `refresh()` to dispatch it.

Aliases declare the canonical route's parameter names and an optional compatibility
window. `preserve` keeps the alias URL; default `canonicalize` replaces it before
activation. Redirect callbacks return a named target or same-origin URL, optionally
asynchronously. Every alias/redirect hop counts toward `maxRedirects` (default 5).
A bound failure rejects and reports `route:error`; the router does no compile-time
analysis of all potentially overlapping route patterns.

`navigate()` returns `{ committed, finished }` synchronously. Each property is a
Promise<boolean>. `committed` concerns URL commitment; `finished` awaits the handler
and all redirect targets. `start()`, `refresh()` and `back()` return their readiness
Promise directly. Failure rejects; supersession/cancellation yields `false`.
A stopped router may restart. `refresh()` replaces the current entry; it currently
takes no arguments. `back()` follows its own traversal's redirects, including target
failure, instead of treating another navigation's result as success.

`route` announces a committed current Match before the handler. `route:ready`
announces a still-current fulfilled handler; `route:error` announces a current
failure. Pure `match(url)` does no redirect or history work and has null navigation
fields. A live handler receives an ActiveMatch with an AbortSignal, also in its
context. A match's signal aborts on supersession or stop, including after readiness.

Cancellation after an asynchronous wait is checked before readiness/error delivery.
This branch preserves existing settlement timing: stop aborts authority immediately,
but a handler or redirect that ignores cancellation may keep `finished` pending until
it settles. Prompt abort settlement would be a separate behavior decision. Callers
must pass/check the signal before effects after awaits; no router can undo arbitrary
side effects in app code. Synchronous callback failures abort their operation; there
is no new rollback or attempt-all cleanup policy.

Entry state is a plain object (including a null-prototype object), or null/undefined
where allowed. It carries a reserved `@mnjs/router` ownership marker, stripped from
Match state. Nested values still use the driver's structured-clone semantics.
Same-path replacements preserve omitted state; pushes/different-path replacements
start empty. The memory driver and native adapter share the public Driver contract.
The native adapter requires an active document Navigation object. There is no DOM,
link interception or History API polyfill in core Router itself; native navigation
supplies link events and the router requests manual focus/scroll handling.

## Child selection and readiness

Register children through Application ownership, then use the optional selector:

```js
async function activate(match, owner, pages) {
  const page = await pages.show('page', {
    key: { id: match.params.id },
    options: { id: match.params.id, region: owner.getView().getRegion('content') },
  });
  if (!page || match.signal.aborted) return;
  return page.showRoute(match);
}
```

The returned child is authoritative: `undefined` means this selection was canceled
or superseded. Do not re-read the registered child to bypass that result. Return
and await detail activation if the detail is required for page readiness; an
Application `onStart` notification itself does not await returned Promises.
A page that has no per-match activation needs no `showRoute` method.

Reuse requires the same child instance, registration name and structural key. A
new key or `restart: true` stops the previous child synchronously and starts the
new selection. Stop/start reconstructs UI. `Application.restart()` instead retains
the running feature while preparing again; a retained restart of the owner therefore
does not abandon selection. If a child replaces its initial preparation with its
own restart, the original `show()` resolves `undefined` for the superseded start
and leaves that replacement running. `getCurrent()` identifies selection, not a
promise of readiness. A host that requires replacement readiness must await the
child-owned restart explicitly; the outlet does not infer private pending work.
Likewise, an independently stopped selection stays selected until the next
selection/stop operation. Application cancellation already stops its descendants.
A stopped owner may still prepare registered children,
as Marionette permits. Owner stop cancels pending child starts; a second stop of an
already-stopped owner can stop children without emitting owner stop notifications.
Owner destruction destroys the outlet, and destroying the outlet leaves child
ownership with the Application. A destroyed outlet cannot start more children.

Startup failure stops the partially prepared selection and reports the original
failure. The existing `onCleanupError(error, app)` callback reports cleanup failure
while preserving that asynchronous startup error. This does not add synchronous
registration/constructor rollback or a general recovery engine.

**Naming decision still open:** the source app deliberately uses `restart: true`
for reconstruction of list pages. This branch keeps that behavior pending a decision
on `reconstruct`/another explicit name. Silently calling Application.restart() would
change retention and failure behavior for existing callers. No rename alias is added.

## What app-frontend established

The source app routes AppFrame → workspace → area → page/detail with plain
Applications and outlets. AppFrame waits for workspace activation; area hosts
await selection then delegate to page detail. This is evidence for a render-agnostic
router and an optional selector, rather than compulsory router Application classes.

The prior behavior/pattern reviews identified host obligations: AppFrame must stop
its global router; workspace must honor canceled selection; stale patient detail
work must check authority after imports/awaits; required program sidebar startup
must be awaited; startup failures need explicit recovery policy. These remain
consumer responsibilities. This extraction does not edit app-frontend or claim that
package fixes repair those host paths. An automatic activation callback or larger
coordinator remains possible if another application demonstrates a need; it is
not required here.

## Bounded follow-up decisions

- A History API driver broadens browser support, but also needs link delegation,
  state/entry ownership and traversal conformance. It is not an incidental extraction
  fix and the old prototype is not silently substituted for this package.
- `refresh({ info })` has a plausible intent-passing use case. It is additive API work,
  not necessary to correct the existing no-argument refresh contract.
- `reflect()` needs a first consumer and an explicit current-Match/cancellation/event
  policy. Neither it nor the older prototype's string outcomes are adopted here.
- WebKit traversal destination state has historical limits; no speculative adapter
  workaround or fresh Safari parity claim is included.
- Before public release: settle source rights/versioning, integrate all release
  inventory/fixture/size tooling, meet coverage policy, and run native-browser
  conformance plus actual application integration checks.
