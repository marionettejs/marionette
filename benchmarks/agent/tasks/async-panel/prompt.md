# Invalidate stale asynchronous panel requests

Implement `solution.mjs` in this workspace. Return a plain controller `{region, open(id), stop(), destroy()}`. open awaits `load(id)` and shows its string result in a stateless View; it resolves true only if displayed, false for an obsolete request. Latest request wins even when promises settle out of order. stop invalidates pending requests and empties content; failures propagate while preserving current content. destroy invalidates and destroys the Region; future open returns false without loading.

Export `createAsyncPanel(el, load)`. Use only documented public `marionette` package APIs. Framework owners render/destroy their own children; never touch underscored members. Do not change the test tooling or dependencies. Your implementation may add local files. Use supplied callbacks and resources; do not add network access, timers, or global singletons. Input labels are untrusted text.

A fresh workspace is evaluated after the attempt. Hidden acceptance sources are not available during the attempt. Completion requires all outcomes, including repeated use, invalid inputs, and cleanup. No specific internal design is asserted except the explicitly requested public owner roles.
