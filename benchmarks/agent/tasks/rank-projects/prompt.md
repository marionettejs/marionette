# Reorder rows without losing editable drafts

Implement `solution.mjs` in this workspace. Return `{view, reorder(ids), remove(id), destroy()}`. Each project has id/label and a row with an input initialized to label. Reordering a permutation of all current ids moves existing row DOM (preserve input drafts), without changing domain objects. Reject duplicate/missing/unknown ids before altering order. remove destroys one row; repeated remove is harmless.

Export `createRankedProjects(el, projects)`. Use only documented public `marionette` package APIs. Framework owners render/destroy their own children; never touch underscored members. Do not change the test tooling or dependencies. Your implementation may add local files. Use supplied callbacks and resources; do not add network access, timers, or global singletons. Input labels are untrusted text.

A fresh workspace is evaluated after the attempt. Hidden acceptance sources are not available during the attempt. Completion requires all outcomes, including repeated use, invalid inputs, and cleanup. No specific internal design is asserted except the explicitly requested public owner roles.
