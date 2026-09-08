# Replace asynchronously acquired subscriptions without leaks

Implement `solution.mjs` in this workspace. Return a plain class instance or plain object `{start(), stop(), destroy()}`. acquire returns a promise for a provider with subscribe(onMessage)->unsubscribe and close(). start resolves true after subscribing. Overlapping starts: latest wins; any stale acquired provider closes immediately without subscribing, and that start resolves false. stop unsubscribes and closes current provider; destroy also rejects future starts by returning false. Do not use Application just to own a service.

Export `createSession(acquire, onMessage)`. Use only documented public `marionette` package APIs. Framework owners render/destroy their own children; never touch underscored members. Do not change the test tooling or dependencies. Your implementation may add local files. Use supplied callbacks and resources; do not add network access, timers, or global singletons. Input labels are untrusted text.

A fresh workspace is evaluated after the attempt. Hidden acceptance sources are not available during the attempt. Completion requires all outcomes, including repeated use, invalid inputs, and cleanup. No specific internal design is asserted except the explicitly requested public owner roles.
