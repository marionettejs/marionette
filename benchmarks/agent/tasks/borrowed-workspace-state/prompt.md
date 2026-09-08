# Keep borrowed domain and state sources alive

Implement `solution.mjs` in this workspace. Return `{app, child, view}`. Parent Application owns child named `editor`; child presents a fresh View via its Region on each start. Parent, child and View borrow the supplied sharedState using the state option, never a factory. Configure StateApi disposeOwned to call source.dispose() for genuinely owned sources. The `view` property is a getter for the current View. Its model must be the exact supplied `domain` object. Start/stop/restart/destroy must never dispose borrowed state or domain model. Public getState returns the supplied identity on all three owners. Do not transfer child ownership to a second parent.

Export `createStateWorkspace(el, sharedState, domain, lifecycle)`. Use only documented public `marionette` package APIs. Framework owners render/destroy their own children; never touch underscored members. Do not change the test tooling or dependencies. Your implementation may add local files. Use supplied callbacks and resources; do not add network access, timers, or global singletons. Input labels are untrusted text.

A fresh workspace is evaluated after the attempt. Hidden acceptance sources are not available during the attempt. Completion requires all outcomes, including repeated use, invalid inputs, and cleanup. No specific internal design is asserted except the explicitly requested public owner roles.

## Deferred lifecycle and session resource

The required fourth argument `lifecycle` provides `ready(signal) -> Promise<void>`
and `subscribe() -> unsubscribe`. Await readiness through the parent's public
`onBeforeStart(application, options, context)` callback, passing `context.signal`
unchanged. No child View or subscription may be created before readiness completes.
Keep the native lifecycle semantics: compatible in-flight restart calls share their
operation; stop/destroy can cancel pending readiness. A canceled start/restart resolves false and late readiness must never mount content
or subscribe. Cancellation signals must be observable by the supplied provider.

Subscribe once after a successful start. Release that session subscription exactly
once through public Application lifecycle callbacks on stop, restart, or destroy.
A restart releases the old session before awaiting new readiness, creates a fresh
View only after readiness succeeds, and preserves Application state. Destroy during
pending readiness cancels it and cannot resurrect the Application or a View.
