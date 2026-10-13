# Router design and migration boundaries

## Chosen scope

A router can map intent to URLs and mark which navigation still has authority
without owning the application lifecycle. The prototype keeps four lifetimes
separate: navigation publication, shared resource preparation, mounted host/feature,
and presentation. Same-patient detail changes can reuse one pending patient load,
while a workspace change ends that scope and starts a new one.

| Design | Benefit | Cost / decision |
| --- | --- | --- |
| Pure named URL table | Smallest incremental step; stable hrefs and explicit params | Does not coordinate navigation; adopt first |
| URL dispatcher + injected transport | Explicit cancellation, history semantics, deterministic tests, host adapters | Selected optional core; features retain ownership |
| Nested loader/lifecycle route tree | Declarative composition and shared loaders | Introduces caching, readiness, error and teardown policy already owned elsewhere; deferred |

The modern JavaScript surface is plain objects, named parameters, promises,
AbortSignal, URL and URLSearchParams. Generated declarations support TypeScript
without requiring application consumers to convert from JavaScript. Native History
is the baseline; newer Navigation/URLPattern APIs are not required.

## Concrete integration

An existing positional event such as
`channel.trigger('patient:interaction', patientId, interactionId, entryTarget)`
can map to a named route with `{ workspace, patientId, interactionId }` and
transient `{ info: { entryTarget } }`. The extra focus/expansion intent is not
silently added to the URL or replayed on Back/Forward.

When a feed clears a deep-link target before a date/filter operation, it can call
`reflect(feedTarget)` to replace the URL without redispatch. Its own operation
then cancels/restarts feed work. Navigation cancellation must not destroy its
retained loading/retry shell or cancel a shared parent fetch.

The ownership fixture binds a borrowed Region's destruction before preparation
begins, because no View may exist yet. Only the newest same-scope waiter dispatches
detail after preparation. Switching scope stops the old owner. Application
`start()` on an already-active feature is not an options update API; explicit
operations or `restart()` handle retained feature changes.

Product return-to-list state, filter preferences, auth return URLs, permissions,
lazy chunk retry, missing-target fallback and paging anchors stay with their
current application owners. A product submit-back action that pushes a previous
URL must not silently become native history traversal.

## Incremental path

1. Extract named URL definitions while retaining the current host.
2. Transfer one family's inbound matcher and outbound events together. Keep the
   host as sole native routing owner; never mount a second native driver.
3. Extract repeated selection logic only when another consumer warrants it.
4. Switch global transport once every family and product history policy is known.

The test-only Backbone bridge wraps public `navigate` and `loadUrl` after existing
wrappers and removes them in reverse order. Silent legacy writes invalidate old
intent. Wrapping only route events missed silent navigation; wrapping only
`navigate` missed reentrant redirects during direct replay/native traversal.
An independent review also exposed synchronous product-history notifications
during a write: nested B could otherwise pair old match A with URL B. The core
checks for a newer accepted transition before publishing A and returns superseded.
This supported borrowed-host case does not add rollback or attempt-all cleanup.

The bridge cannot observe equal-fragment POP suppressed by Backbone. Exact entry
keys/state and restoration therefore wait for a stronger host contract or global
cutover. A legacy event handler that navigates and is then followed by another
legacy writer remains an application event-ordering problem. The router cannot
override arbitrary subsequent synchronous code.

## Evidence boundaries

This branch uses public, portable fixtures; no private application source or
workstation paths are required. Earlier read-only application investigation
motivated the cases, but its private source-specific evidence is not a public
release claim. The branch does not migrate that application.

Headless fixtures test actual history timing and target geometry. They use manual
document scroll restoration as explicit fixture policy and show that the router
does not restore nested scroll/focus. Full product E2E, auth, workspace registration,
query/storage precedence, cross-document history/BFCache, the complete browser
support matrix, performance budgets and release certification remain separate.
