# Keep shell navigation while replacing notices

Implement `solution.mjs` in this workspace. Return `{view, notify(text), destroy()}`. Root has independent `navigation` and `notice` Regions. Navigation contains a button labeled Home that calls onNavigate("home") once per click. notify replaces a text-only notice without replacing navigation. Destroy releases navigation click handlers.

Export `createNoticeShell(el, onNavigate)`. Use only documented public `marionette` package APIs. Framework owners render/destroy their own children; never touch underscored members. Do not change the test tooling or dependencies. Your implementation may add local files. Use supplied callbacks and resources; do not add network access, timers, or global singletons. Input labels are untrusted text.

A fresh workspace is evaluated after the attempt. Hidden acceptance sources are not available during the attempt. Completion requires all outcomes, including repeated use, invalid inputs, and cleanup. No specific internal design is asserted except the explicitly requested public owner roles.
