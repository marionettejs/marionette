# Release document dismissal listeners for a shared overlay

Implement `solution.mjs` in this workspace. Return `{region, open(view), destroy()}`. Use one shared Region for live Views. documentEvents supplies addEventListener/removeEventListener. Register Escape keydown only while an overlay is open. Replacing an overlay must not duplicate listeners; Escape empties and unregisters; direct `region.empty()` and destruction of the current View also unregister immediately; reopening registers once; destroy releases everything. Keep dismissal/exclusivity outside Region.

Export `createDismissibleOverlay(el, documentEvents)`. Use only documented public `marionette` package APIs. Framework owners render/destroy their own children; never touch underscored members. Do not change the test tooling or dependencies. Your implementation may add local files. Use supplied callbacks and resources; do not add network access, timers, or global singletons. Input labels are untrusted text.

A fresh workspace is evaluated after the attempt. Hidden acceptance sources are not available during the attempt. Completion requires all outcomes, including repeated use, invalid inputs, and cleanup. No specific internal design is asserted except the explicitly requested public owner roles.
