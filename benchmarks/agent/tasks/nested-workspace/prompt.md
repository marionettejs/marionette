# Replace nested workspace panels

Implement `solution.mjs` in this workspace. Return `{view, showDetail(label), clear(), destroy()}`. The root View owns a `detail` Region inside its template. Showing a detail replaces and destroys the previous stateless View; clear empties only the Region; destroy tears down root and current child.

Export `createWorkspace(el)`. Use only documented public `marionette` package APIs. Framework owners render/destroy their own children; never touch underscored members. Do not change the test tooling or dependencies. Your implementation may add local files. Use supplied callbacks and resources; do not add network access, timers, or global singletons. Input labels are untrusted text.

A fresh workspace is evaluated after the attempt. Hidden acceptance sources are not available during the attempt. Completion requires all outcomes, including repeated use, invalid inputs, and cleanup. No specific internal design is asserted except the explicitly requested public owner roles.
