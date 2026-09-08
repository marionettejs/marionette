# Keep borrowed domain and state sources alive

Implement `solution.mjs` in this workspace. Return `{app, child, view}`. Parent Application owns child named `editor`; child presents a fresh View via its Region on each start. Parent, child and View borrow the supplied sharedState using the state option, never a factory. Configure StateApi disposeOwned to call source.dispose() for genuinely owned sources. The `view` property is a getter for the current View. Start/stop/restart/destroy must never dispose borrowed state or domain model. Public getState returns the supplied identity on all three owners. Do not transfer child ownership to a second parent.

Export `createStateWorkspace(el, sharedState, domain)`. Use only documented public `marionette` package APIs. Framework owners render/destroy their own children; never touch underscored members. Do not change the test tooling or dependencies. Your implementation may add local files. Use supplied callbacks and resources; do not add network access, timers, or global singletons. Input labels are untrusted text.

A fresh workspace is evaluated after the attempt. Hidden acceptance sources are not available during the attempt. Completion requires all outcomes, including repeated use, invalid inputs, and cleanup. No specific internal design is asserted except the explicitly requested public owner roles.
