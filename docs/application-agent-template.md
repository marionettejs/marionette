# Record an application's agent instructions

Use this template to record decisions an agent cannot safely infer from Marionette
alone. It belongs in the application repository's instruction file, usually
`AGENTS.md` when supported by the agent client. Merge it with existing instructions
instead of replacing unrelated project policy.

Fill each field from the installed package, lockfile, configuration, and actual
test scripts. Delete irrelevant fields. A question still being decided should be
marked unresolved, with the constraint that blocks the decision; do not turn a
placeholder into an invented default. Never put credentials or private customer
data in these instructions.

```markdown
# Marionette application context

## Installed contract

- Application workspace: [directory containing this application's manifest].
- Marionette package/version and install source: [lockfile and resolved package].
- Documentation: [installed dist/docs path or exact release/source snapshot].
- Source revision and local changes, when known: [manifest provenance].
- Optional Marionette packages: [actual versions, or none].

Use matching documentation. Check the installed exports before adopting an API
from an external example. Do not change dependency versions to make a snippet fit.

## Integration decisions

- Runtime and registration point: [actual module; shared or isolated and why].
- Renderer/templates: [actual choice and setup module].
- Data sources and DataApi: [actual choice, observability, registration or default].
- State sources and StateApi: [actual choice, ownership, registration or default].
- DomApi and EventDelegator: [actual choices or defaults].
- Router: [actual library or none; URL/history owner].
- Navigation/loading: [controller or feature owner; stale-result policy].

Preserve compatible established choices. Select these capabilities independently;
a router choice does not imply a data, state, renderer, or DOM adapter change.

## Ownership and verification

- Root mount and View/Region owner: [actual entry point].
- Shared resources and disposal owners: [actual subscriptions/state/widgets].
- Unit/component check: [existing command and working directory].
- Browser interaction check: [existing command and working directory].
- Build/type check: [existing command and working directory].
- Relevant existing patterns: [a few actual source or test paths].

For the changed behavior, verify the appropriate interaction and cleanup boundary.
Report the checks actually run and anything left untested. Update this file when
an application decision changes; keep the API reference in the matching docs.
```

Keep the completed file short. Link to substantial project architecture or test
guides rather than copying them. The purpose is to preserve the application's
choices across tasks, not to prescribe a new router, test runner, or framework.
For skill installation and optional services, see [Set up an agent](./agent-tools.md).
