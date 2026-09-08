# Subscribe a status Behavior with deterministic cleanup

Implement `solution.mjs` in this workspace. Return a View whose Behavior subscribes once to `statusSource.subscribe(callback)`, which returns an unsubscribe function. The callback receives text to show in an output element. Rendering again must preserve one subscription and latest status. Destroy unsubscribes exactly once. This is a View concern, not an Application.

Export `createConnectionStatus(el, statusSource)`. Use only documented public `marionette` package APIs. Framework owners render/destroy their own children; never touch underscored members. Do not change the test tooling or dependencies. Your implementation may add local files. Use supplied callbacks and resources; do not add network access, timers, or global singletons. Input labels are untrusted text.

A fresh workspace is evaluated after the attempt. Hidden acceptance sources are not available during the attempt. Completion requires all outcomes, including repeated use, invalid inputs, and cleanup. No specific internal design is asserted except the explicitly requested public owner roles.
