# Filter projects while retaining owned rows

Implement `solution.mjs` in this workspace. Return `{view, filter(query), destroy()}`. Use CollectionView and one child per project `{id,label}`. Filtering is case-insensitive substring matching and must reveal the same live row instances when cleared. Do not mutate the supplied domain array or objects. Render labels as text.

Export `createProjects(el, projects)`. Use only documented public `marionette` package APIs. Framework owners render/destroy their own children; never touch underscored members. Do not change the test tooling or dependencies. Your implementation may add local files. Use supplied callbacks and resources; do not add network access, timers, or global singletons. Input labels are untrusted text.

A fresh workspace is evaluated after the attempt. Hidden acceptance sources are not available during the attempt. Completion requires all outcomes, including repeated use, invalid inputs, and cleanup. The required design is a CollectionView with one child per project; acceptance checks that role and the stated filtering, text rendering, identity, non-mutation, and cleanup outcomes.
