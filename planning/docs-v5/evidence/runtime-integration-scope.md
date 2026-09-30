# Runtime integration disposition

Step 2 of the [follow-up checklist](../follow-up-checklist.md). Audited on
2026-09-30 at `b1a2b39e6bde6ce5605b0cfff00f9408652f4b39` against frozen upstream
`74534f719e9ae6bf00fb6061e9f8cb712e92e2ef` (#594). This identifies an integration
decision; it is not a fresh upstream fetch or release approval.

## Decision

Keep the existing runtime cleanup commit
`e306ca7b379a2522335220f140d5b64725ecd9e0` and public-test refinement
`deb62c26519e582f287d90fb22d4918e41b54b53` on the reset branch. The maintainer
already requested automatic incoming listener cleanup for v5. The docs and examples
rely on that contract. A history rewrite or duplicate cherry-pick of #594 is not
needed. Treat these as an explicit runtime part of integration rather than calling
the branch documentation-only.

Frozen upstream already releases core incoming subscriptions after successful
destruction. The reset adds terminal `try/finally` handling and Behavior incoming
cleanup. Both branches share predecessor `b6f23c5953793d5cef1cb51dbc675420214ffd01`.
Later integration must reconcile the overlapping source changes once, retaining
the supported final-notification ordering and the terminal cleanup regression tests.

## Complete source delta

| Source | Difference beyond frozen upstream |
| --- | --- |
| `src/mixins/destroy.ts` | Final Radio/state cleanup and destruction notifications run inside a subscription-cleanup `finally`; a type `Pick` reorder is cosmetic. |
| `src/modules/application.ts` | Terminal incoming/outgoing subscription cleanup after asynchronous destruction commits terminal state. |
| `src/modules/region.ts` | Subscription cleanup when the final destruction notification throws. |
| `src/mixins/view.ts` | Terminal subscription cleanup, including Behavior incoming listeners after final host/Behavior notifications. CollectionView shares this path. |
| `src/modules/behavior.ts` | Direct destruction clears incoming listeners while the host is alive; host destruction defers them until final host notifications. No independent Behavior lifecycle event is introduced. |
| `src/mixins/behaviors.ts` | Types the Behavior `off()` call used by host cleanup. |
| `src/modules/view.ts`, `src/modules/collection-view.ts` | JSDoc examples use the optional Lit adapter/template interpolation; commit `2edaf90df`. No runtime behavior change. |

Optional package source files are identical to the frozen comparison revision.

View destruction sets `_isDestroyed` before destroying Behaviors. The existing
`_removeBehavior` guard retains the managed array during terminal host destruction,
so the final host pass can release Behavior incoming listeners after forwarding
notifications. Direct Behavior destruction instead removes it while the host lives
and clears its incoming listeners immediately. No new finalization state is needed.

## Bounded guarantees

The subscription guarantee begins inside the existing final `try` blocks. Earlier
`before:destroy`, detach/child teardown, Region reset, or Application preparation,
stop and owned-child/Region teardown may throw before those blocks are reached.
Cleanup overrides themselves can throw. Remaining resource cleanup and later
notification delivery are not guaranteed after a throw. This adds no rollback,
attempt-all resource cleanup or automatic retry contract.

Broader recovery needs a separate demonstrated consumer requirement. It is not a
dependency of symbol lookup or reference delivery.

## Verification

An independent subagent inspected the full frozen source delta and existing public
tests, then ran:

```sh
npm test -- test/unit/destroy-listener-cleanup.spec.js \
  test/unit/behavior-lifecycle.spec.js test/unit/behavior-composition.spec.js
```

**40 passed in 3 files:** cleanup 25, Behavior lifecycle 12, composition 3. No
supported-workflow regression was found in this bounded audit. The prior assessment
also ran 54 cleanup/Application binding/restart tests; these are separately scoped
checks, not additive unique coverage or a full-suite result.

No runtime source was edited or rebuilt for this decision. Existing installed
integration evidence remains scoped to its own artifact. This audit does not
certify publication, deployment, the entire runtime or reader effectiveness.

## Integration on 2026-10-01

Fetched master at the same `74534f719e9ae6bf00fb6061e9f8cb712e92e2ef` revision.
Reconciled its overlapping cleanup changes with the reset's terminal cleanup path,
retaining Behavior cleanup and the final-callback failure checks. Retained master's
public subscription regression tests and browser replacement test, and registered
that browser test in the release inventory. Updated semantic records to route to
the rebuilt event reference; superseded doc pages remain removed.

The complete docs/tooling closeout was committed before integration at `37a74339`.
Fresh integrated checks and immutable artifacts are recorded separately in the
[RC2 readiness checklist](../../rc2-readiness.md).

Fresh integration checks passed: cleanup 39, Behavior lifecycle 12 and composition
3 (54 total); lint; and the 2 browser-artifact setup tests. The complete initial
release-harness run had 130 passes and one temporary fixture-commit GPG failure.
Fixture commits now disable signing explicitly; full certification reruns the
harness under tooling coverage. No global Git configuration was changed.

The first complete candidate browser run retained 207 passes and 6 failures in
two obsolete package-starter tests. The npm package intentionally no longer ships
that authored application. Browser validation now serves the repository's consumer
fixture against the supplied packed exports; the portable development kit uses its
explicit fixture file list. Draft/focus, stale selection, teardown, sourcemaps and
repeated Vite replacement assertions remain. Both corrected tests passed in
Chromium, Firefox and WebKit (6 checks). The retired npm-starter-copy path was
removed; installed quick-start setup remains checked by `docs:check`.

The complete failed certification attempt also passed 2,139 unit tests, 395 tooling
tests, documentation and distribution checks. These remain evidence for that exact
earlier candidate, not certification of the subsequent harness correction. Build
and certify new artifacts from the committed corrected source.
