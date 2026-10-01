# Compose owned Application and View state

Implement `solution.mjs` in this workspace. Return `{app, child, view}`. Parent Application owns child Application named `editor`; child presents the returned View via its Region. Configure StateApi disposeOwned to call source.dispose(). Parent, child and View use createState factories producing distinct sources from makeState(role), using role 'app' for the parent Application, 'child' for the child Application, and 'view' for the View. Expose all through public getState. Start/stop/restart retains Application state. A running restart retains the existing View and its state; a start or restart after stop creates a fresh View and its state. The returned `view` property must be a getter for the current View. Destroy disposes each owned state exactly once. Domain data passed as model must retain identity and never be disposed.

Export `createStateWorkspace(el, makeState, domain, lifecycle)`. Use only documented public `marionette` package APIs. Framework owners render/destroy their own children; never touch underscored members. Do not change the test tooling or dependencies. Your implementation may add local files. Use supplied callbacks and resources; do not add network access, timers, or global singletons. Input labels are untrusted text.

A fresh workspace is evaluated after the attempt. Hidden acceptance sources are not available during the attempt. Completion requires all outcomes, including repeated use, invalid inputs, and cleanup. No specific internal design is asserted except the explicitly requested public owner roles.

## Deferred lifecycle and session resource

The required fourth argument `lifecycle` provides `ready(signal) -> Promise<void>`
and `subscribe() -> unsubscribe`. Await readiness through the parent's public
`prepareStart(options, context)` callback, passing `context.signal`
unchanged. No child View or subscription may be created before readiness completes.
Keep the native lifecycle semantics: each restart supersedes earlier preparation;
stop/destroy can cancel pending readiness. A canceled start/restart resolves false and late readiness must never mount content
or subscribe. Cancellation signals must be observable by the supplied provider.

Subscribe once after a successful start. Release that session subscription exactly
once through public Application lifecycle callbacks on stop or destroy.
A running restart retains the View, its state and the session subscription while
awaiting new readiness. A start or restart after stop creates a new View and subscription
only after readiness succeeds. Destroy during
pending readiness cancels it and cannot resurrect the Application or a View.
