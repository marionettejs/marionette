# Coordinate exclusive overlays outside a shared Region

Implement `solution.mjs` in this workspace. Return a plain controller `{region, open(view, anchor), close(), destroy()}` with one real Region. Accept only live Marionette Views, reject non-Views/destroyed Views before disturbing current content. Position outside core by calling supplied `position(view.el, anchor)` after show. Replacing destroys previous View; close empties. Do not turn the controller or overlay service into an Application or MnObject.

Export `createOverlayHost(el, position)`. Use only documented public `marionette` package APIs. Framework owners render/destroy their own children; never touch underscored members. Do not change the test tooling or dependencies. Your implementation may add local files. Use supplied callbacks and resources; do not add network access, timers, or global singletons. Input labels are untrusted text.

A fresh workspace is evaluated after the attempt. Hidden acceptance sources are not available during the attempt. Completion requires all outcomes, including repeated use, invalid inputs, and cleanup. No specific internal design is asserted except the explicitly requested public owner roles.
