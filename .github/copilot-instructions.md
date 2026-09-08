# Marionette agent guidance

Follow the canonical repository instructions in [AGENTS.md](../AGENTS.md), the
[test guide](../test/README.md), and [ROADMAP.md](../ROADMAP.md). Tests and fixtures
must use public package entrypoints and observable behavior, with no private
framework access. Keep agent tooling out of production imports and report only
validation that actually ran.

Apply the [synchronous failure boundary](../docs/view.lifecycle.md#synchronous-failures)
during implementation and review. Synchronous registration, construction, rendering,
and teardown failures abort; adapters must provide working cleanup callbacks. Public
API tests, retention checks, and mutation survivors do not justify new rollback,
attempt-all/first-error cleanup, per-instance recovery bookkeeping, or hot-path guards
for unsupported callback mutation. Require an explicit maintainer decision on a real
consumer case and its complexity/performance tradeoff before such changes. Preserve
existing ownership/idempotence guards and Application's documented asynchronous
readiness, cancellation, and restart behavior. Identify proposed contract expansions
as such in review; do not present them as required bug fixes.
