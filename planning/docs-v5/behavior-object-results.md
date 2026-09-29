# Behavior and MnObject reference results

2026-09-29. Scope: the two remaining core class references for `5.0.0-rc.2`. No runtime changes in this slice. The earlier staged docs reset and local destruction-cleanup changes remain intact.

## Delivered

- [Behavior](../../docs/api/behavior.md): choosing reusable host interaction, declarations/options, DOM/UI/entity/state bindings, host event forwarding, direct/host teardown, nesting, and types.
- [MnObject](../../docs/api/mnobject.md): choosing a nonvisual lifetime, construction, state/Radio, synchronous destruction and caller ownership, and types.
- [Shared Radio owner bindings](../../docs/api/common.md#declarative-radio-bindings): moved from Application so both classes use one definition.
- Direct links from the API index, documentation index and llms.txt; updated framework inventory and verification harness.

All six core classes now have dedicated references. Runtime/provider authoring, companion packages and standalone conceptual/task guidance remain incomplete. Class coverage is not whole-framework completeness.

## Six quality dimensions

| Dimension | Evidence and limit |
| --- | --- |
| Coverage | [Member audit](evidence/behavior-object-reference-audit.md) accounts for options, inherited APIs, hooks, public types/statics, and internal exclusions. |
| Accuracy | 185 focused source tests in 18 files passed. Installed-package examples and declaration fixtures also passed; results below. |
| Findability | Direct entrypoint links and author lookup paths below work independently of the records lesson. Reader lookup performance remains unmeasured. |
| Architecture | Behavior owns reusable local interaction on its host; MnObject owns tracking state while borrowing the draft. Examples use supported public methods and no example-only correctness helpers. |
| Usability | The examples execute against installed packages. JSDOM and type checks establish bounded correctness, not independent-reader transfer or real browser behavior for these new snippets. |
| Maintainability | Existing probes are extended, shared contracts have one authoritative definition, and unsupported/internal methods remain outside the public reference. More links impose navigation cost to measure later. |

## Author lookup checks

| Question | API-index path | Answer |
| --- | --- | --- |
| Should this interaction be a Behavior? | Behavior introduction | Keep a one-off interaction in its View; reuse local host interaction through a Behavior. |
| Where do DOM triggers and Behavior events go? | Behavior → DOM interaction / Host events | DOM triggers target the host; Behavior triggerMethod stays local unless the Behavior explicitly calls its host. |
| Do host options or state automatically flow into a Behavior? | Behavior → Declare and construct / Host events and data | No; definitions supply its options, and state is independent unless explicitly borrowed. Host model/collection observation uses the host sources. |
| Does direct Behavior destroy run onDestroy? | Behavior → Destruction | No independent notification; onDestroy observes host destruction after Behavior cleanup. |
| Who owns nested Behaviors? | Behavior → Destruction and nested Behaviors | The original host; destroying the declaring Behavior does not destroy nested peers. |
| Does MnObject destroy await hooks or clean up a field's object? | MnObject → Destruction and ownership | Synchronous notifications; arbitrary fields/arguments are not automatically destroyed. |
| What happens to supplied data and created state? | MnObject example / State and communication → State | The draft is borrowed; tracking state is owned and disposed through StateApi. |
| Which Radio bindings are cleaned up? | MnObject → shared Radio owner bindings | Owner bindings on the configured channel; shared channel and unrelated registrations survive. Manual bindings require their own ownership handling. |

## Verification

```sh
node planning/docs-v5/probes/package-discovery.mjs
node planning/docs-v5/probes/reference-contracts.mjs
npx eslint planning/docs-v5/probes/reference-examples.mjs --max-warnings=0
```

[Installed-package report](evidence/behavior-object-package.json): passed. It records 17 commands, five candidate packages, 16 documentation files, 10 executed reference examples (five TypeScript), and ten existing ESM/CommonJS declaration fixtures compiled against installed declarations. Both production builds and all existing browser checks passed: 48 records and 3 quick-start checks across Chromium, Firefox and WebKit. This is a local transformed candidate, not registry installation or production-publisher verification.

New snippet assertions check Escape intent, absence of duplicate delegation after rerender, removed DOM handlers, host UI precedence, trigger direction, and direct versus host Behavior teardown. MnObject checks dirty-state transitions, synchronous/idempotent destruction, released draft listeners, owned/borrowed state, and Radio reply cleanup, including manual owner-context replies, while preserving another owner. Host event forwarding back to the emitting Behavior is checked explicitly. Exact assertions and snippet hashes are in the package report. The [existing contract probe](evidence/behavior-object-contract-checks.json) passed too.

ESLint, `git diff --check`, and all 535 local Markdown links passed. Installed documentation bytes and the snippet-harness hash match the passing report. The refreshed candidate kit contains the five tested tarballs and their quick-start instructions. The staged-reset and runtime-diff hashes match the start of this slice.

The member audit records the exact source-test command and an additional eight checkout declaration fixtures. These are separate from the ten fixtures compiled against the freshly installed package. The full unit suite was not rerun; previously recorded retired-docs missing-file failures remain migration work. No controlled model/fresh-reader trial was run.

## Peer check

[React and Vue comparison](peer-comparison.md#behavior-and-mnobject-reference-check) supports explaining when reuse deserves a named abstraction before presenting all its hooks. The examples stay independent of the records app. No peer execution or measured effectiveness comparison was performed.

## Review

The audit subagent found two broken draft anchors, incomplete UI-normalization signatures, ambiguous Radio state-event gating, and imprecise Behavior incoming-listener timing. All were corrected before the installed-package run.

[Claude review](evidence/behavior-object-claude-review.json) received both new pages, the shared utility page, source/member audit, coverage inventory, draft results, and the completed first package report. Its verdict was **approve with corrections**, with no blocking issues. It identified narrower Radio cleanup wording, host events returning to their sending Behavior, and a stale reference to a removed `setElement` API.

All three were corrected. The final installed snippet checks also assert cleanup of manual owner-context replies and host-event forwarding back to the sender. The page now identifies `behaviorClass` in passed definition options, clarifies repeated custom Behavior cleanup, shortens construction details and avoids implying MnObject has a running/stopped state. Existing `consumer` and `fixed-root` ESM/CommonJS fixtures were added to installed declaration checks for MnObject inference and fixed-root contracts.

Other suggestions were assessed proportionately: the linked state reference already explains MN0037 rather than repeating its configuration warning on every class page. Source tests cover constructor/initialize order and retained Behavior identity (`behavior-lifecycle.spec.js`), nested peer lifetime (`behavior-lifecycle.spec.js`), and template-less CollectionView UI (`behavior-ui-contract.spec.js`); the member audit records their execution. The public generic parameter order was checked directly in exported declarations. These assertions need not all be duplicated in the package probe. The source-diff hash was recomputed and still matches the baseline. The stored review describes its submitted snapshot; the final package run verifies the subsequent corrections.

## Strengths, limitations, and next priority

Strengths: the core reference now has six separate class entrypoints; lifecycle and ownership distinctions are explicit and checked; new examples are short and independent of the original lesson; shared Radio semantics have one home.

Limitations: reference pages are still denser than task guides, and cross-links add navigation cost. Tests do not establish whether a new reader chooses the right abstraction. Full integration, Radio and broader task-guide coverage remain gaps.

Next: runtime configuration and provider contracts, then standalone concepts and remaining companion/task needs, as recorded in the [inventory](coverage.md). Teaching effectiveness requires the later frozen build/extension trial.
