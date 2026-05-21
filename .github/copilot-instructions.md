# Marionette v5 Agent Guidance

Marionette v5 is a compatibility bridge for existing Marionette and Backbone applications. Use the focused v5 issue and its acceptance criteria as the source of truth for any change.

## Scope Rules

- Preserve public runtime behavior unless the issue explicitly allows a behavior change.
- Do not expand v5 runtime architecture.
- Do not opportunistically refactor unrelated code.
- Keep diffs small and reviewable.
- Prefer compatibility fixtures and tests over assumptions.
- Add or update tests for the issue acceptance criteria.
- Run relevant validation commands and report the results.
- Stop and report if implementation requires a public behavior change not listed in the issue.

## v5 Boundaries

v5 may include behavior-preserving mechanical compatibility work, packaging fixes, tests, CI, migration documentation, compatibility fixtures, and type declaration work.

v5 may not introduce new runtime architecture. AI-native architecture remains v6/labs. Machine-readable documentation is allowed only as documentation, not as a product claim.

Do not introduce or encourage v5 scope creep into statecharts, signals, virtual DOM, schema/effect/query platforms, public topology runtime APIs, built-in router, full app rewrite guidance, or AI-native product claims.

Do not position Marionette v5 as a React or Vue competitor. Keep the work focused on the compatibility bridge.
