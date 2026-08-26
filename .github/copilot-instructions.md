# Marionette Agent Guidance

The governing project strategy is [`ROADMAP.md`](../ROADMAP.md). Stable
v5 is the agent-ready release, and production runtime cost is a release constraint.

## Before changing code

- Read the linked issue and the relevant public contract or tests.
- State whether the change is static/docs, development/test, an existing production
  path, or an opt-in runtime path.
- Identify the affected lifecycle, ownership, diagnostic, type, or package contract.
- Stop and report if the issue leaves a public behavior or runtime-cost decision open.

## Implementation rules

- Make one canonical behavior; do not add aliases, fallbacks, or dual paths unless the
  issue identifies a verified compatibility requirement and removal condition.
- Keep diffs focused and remove tests, docs, and dead code for superseded behavior.
- Use public APIs in fixtures and tests. Do not depend on private consumers, private
  repositories, customer data, or undocumented maintainer knowledge.
- Do not read private framework fields from public tooling. Expose the smallest useful
  public contract when a fact the runtime already owns needs to be inspectable.
- Avoid query methods with lifecycle or rendering side effects.
- Use stable diagnostic/rule codes for framework invariants; human-readable messages
  are not the machine contract.
- Add no global registry and no per-instance allocation, listener, subscription, or
  collection for an unused optional feature.
- Keep development, test, lint, benchmark, and rule-catalog modules out of the
  production import graph.
- Treat runtime additions as cost-sensitive. Measure bundle, hot-path, allocation, and
  retention effects required by the issue.
- Do not opportunistically add a renderer, state system, router, query layer, schema
  system, agent protocol, or other unrelated framework architecture.

## Evidence

- Add or update tests for the issue acceptance criteria and documented edge cases.
- Run the smallest commands that prove correctness; report exactly what ran.
- Keep documentation examples executable or drift-checked.
- For agent-readiness claims, use the public reference application and pinned
  benchmark. A successful private experiment is not release evidence.
- For timing measurements, report shared-runner results; enforce hard timing budgets
  only on the controlled release runner. Bundle and module-graph checks may be hard CI
  gates.
