# Scope a save shortcut to its editor Behavior

Implement `solution.mjs` in this workspace. Return a rendered View with a Behavior that handles Ctrl+Enter (or Meta+Enter) keydown within that editor only. Include a textarea; call onSave with its current value once per matching key. Ignore unmodified Enter. Re-render must not duplicate handlers. Destroy must stop callbacks.

Export `createEditor(el, onSave)`. Use only documented public `marionette` package APIs. Framework owners render/destroy their own children; never touch underscored members. Do not change the test tooling or dependencies. Your implementation may add local files. Use supplied callbacks and resources; do not add network access, timers, or global singletons. Input labels are untrusted text.

A fresh workspace is evaluated after the attempt. Hidden acceptance sources are not available during the attempt. Completion requires all outcomes, including repeated use, invalid inputs, and cleanup. No specific internal design is asserted except the explicitly requested public owner roles.
