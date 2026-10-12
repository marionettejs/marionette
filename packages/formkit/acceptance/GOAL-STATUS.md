# Current bounded package status

Last checked code/test and production runtime checkpoint:
`f2c8e62267e6619b7e3a712eb1fcbfaa2a65781a`.
The separately authorized nested RowView extension passes its local gates;
see [NESTED-ROWS.md](NESTED-ROWS.md) for its measured scope.
Branch: `feat/mnjs-formkit-composed-views`. This is unpublished local work.

Use this reconciliation with [PLAN.md](PLAN.md). Earlier checkpoints, source
audits, author trials and chronological EVIDENCE entries keep their original
scope and results. Statements that final checks are pending in those historical
entries do not override the later measurements. Completion of this deliberately
small package slice does not establish the full SPA roadmap or customer migration.

## Agreed first-slice contracts

| Goal | Current outcome | Evidence boundary |
| --- | --- | --- |
| Native fields, grouped values, validation and submission | Complete in the supported slice | Real FormKit nodes, native controls, invalid/valid submit, errors, reset, async cancellation and cleanup have public tests, typed consumers and representative examples. |
| G1 composition | Complete in the supported slice | One FormView root, explicit FieldView parents, keyed RowViews, borrowed SchemaViews and named real Views/CollectionViews use ordinary Marionette ownership. The manifest remains unexported. |
| G2 row/lifetime behavior | Complete in the original slice and authorized two-level extension | Keyed rows with nested objects cover membership/order, edits, retained defaults/errors, delayed mount, detach, replacement and destruction. The original PLAN froze nested owned-array restrictions; the later authorized two-level extension passes its own independent oracle and delivery gates. Membership-changing reset does not promise surviving-control identity. |
| G3 coherent submission/application flow | Complete in the supported slice | Native/validation settlement, cancellation and stale completion regressions pass. Seven synthetic application cases add load/draft snapshots, debounce, external errors, derived origin, keyed writes and discard through destruction/fresh construction. |
| G4 real consumer/authoring evidence | Bounded evaluation complete | Frozen v8 BUILD originals pass 8/8 each; matched original CHANGE is MN 11/11 clean and Vue 8/11 with 10 runtime faults. Earlier private actual-source mocked integrations retain their older checkpoints. No general productivity or post-G6 authoring claim follows. |
| G5 delivery/accessibility | Complete for the measured local routes | Installed ESM/CJS/types and representative Chromium routes pass. Labels, keyboard use, focus, associated errors and DOM live-region updates are covered. Screen-reader speech, Firefox/WebKit and all compound-control accessibility are unverified. |
| G6 schema API/data exposure | Supported shared slice passes; stronger certificate blocked | Genuine installed MN/Vue share byte-identical JSON and 16 passing outcomes. Explicit root-data binding, local node scope, caller receivers, slots, registries, validation, reset and updates are covered. The stronger shared terminal-lifetime probe retains its Vue hard failure. |
| G7 package simplicity | Scoped cleanup complete | Nine production modules retain one Core graph and ordinary lifecycle ownership. Redundant state/checks were removed; the covered experiment is outside shipped source/declarations. No runtime Vue/React/Pro dependency or new parallel composition API was added. |

Schema expressions use public Core schema/compiler contracts. `$values` is supplied
explicitly as current root data; it is not an invented upstream global. Native
commits and supported setters refresh form-owned schemas through node events.
Arbitrary external object mutations are not automatically observed: use
`setSchemaData`, `setSchema` or renderer `update`. A supplied slot data scope
replaces its scope and must explicitly retain a root binding when needed.
These are the reviewed [v2 boundaries](SCHEMA-PORTABILITY-v2.md), not missing
framework reactivity or a promise of Vue/React API parity.

At `a545a7b1`, repository verify passed **2,481 tests in 168 files**, build/types,
lint, profile/API/public-test/workflow checks. Configured coverage passed with all
nine production FormKit modules plus the isolated experiment at **100% statements,
branches, functions and lines**; existing repository exceptions were unchanged.
The seven new application cases passed independent review, including a timer
negative control that failed when application cleanup was removed. Runtime bytes
were unchanged from `6611aa55`. Installed-format and Chromium 10/10 evidence remain
at their recorded earlier checkpoints; they were not rerun for the test/guidance
change. See [APPLICATION-CONTRACTS.md](APPLICATION-CONTRACTS.md) and
[LOCAL-CHECKPOINT.md](LOCAL-CHECKPOINT.md).

The later nested checkpoint passes repository verify **2,491/169**, unchanged
configured FormKit coverage at **100% all four metrics**, installed ESM/CJS/types
with six nested and twenty existing lifecycle cycles, Vite example production
build, Chromium **11/11**, and all documentation pipeline stages. Source and test
hashes remained unchanged between final coverage and verification. Independent
reviews preserve the identical final eight-case before/after oracle, the cached
foreign-owner regression, inner-only reset and a meaningful sibling-default
mutation control. Earlier failed attempts remain recorded in
[NESTED-ROWS.md](NESTED-ROWS.md); no File/shared-Vue failure or frozen author trial
was repaired by this extension.

## Remaining requirements and differences

| Item | Disposition | Why no new implementation here |
| --- | --- | --- |
| Stronger shared lifecycle certificate | Blocked, not passed | Genuine Vue retained-control input dispatch after unmount accesses destroyed context. The minimal upstream baseline and strict red remain preserved; MN cleanup passes its own retained-control outcomes. |
| Same-metadata File replacement | Unresolved dependency limit | Core/MN/Vue retain old File bytes in the strict case. The unsafe adapter guard was rejected and is not shipped. Ordinary upload tests do not repair or waive this failure. |
| Actual application/host and paid controls | Required external stages remain unverified | Engine/UI and host source inspection is available and reconciled; source-level submit/error routing differences remain separate. No actual host transport, remote durability, full clinical UI or licensed Pro run is certified. Source access is not the blocker previously described by guessed paths. |
| Server-baseline adoption | Unimplemented broader product requirement | No new rebase policy is approved. The inspected application's discard clears its draft and recreates the form lifetime; the current construction reset is sufficient for the bounded contract. Do not declare all future server-reset needs complete or unnecessary. |
| Nested custom RowViews | Supported two-level extension; broader depth unverified | Existing parent/itemKey/rowKey/removal APIs now use complete ancestor-key addressing for defaults, exclusions, cleanup and construction reset. Every ancestor array requires an owned row group. The independent eight-case oracle fails before and passes after; installed formats/types, Chromium 11/11 and all four FormKit coverage metrics at 100% pass, as recorded in NESTED-ROWS.md. Broader depth and raw unowned arrays remain unverified. |
| Broader error policy | Open product reconciliation | Existing external engine errors stay application-owned through edits, with visibility separate from storage and clearing at the valid engine-submit transition. FormKit message clearing remains a distinct documented adapter contract. No policy matrix or new default was approved. |
| Automatic aliases/framework conveniences | Optional adapter differences | Automatic root aliases, arbitrary external deep observation, provider/ref/event parity and standalone framework UI helpers are not prerequisites for this native package slice. Add convenience only for a verified consumer need. |
| Canonical integration/transfer/release | Not performed; migration blocked | Canonical v5 was inspected for used API compatibility only, without patch/build/test integration. Library tool discovery failed before upload on the initial attempt and the one authorized retry. No push, publication, release, merge, deploy or environment move occurred. |

The docs-only goal reconciliation found no new runtime defect at its recorded
checkpoint. The later nested extension has separately preserved baseline failures
and independent candidate results; its review also found and repaired a cached
list ownership guard that incorrectly accepted a foreign FormView. Historical
frozen trials and unresolved File/Vue failures retain their original outcomes.
