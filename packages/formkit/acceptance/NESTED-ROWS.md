# Two-level custom RowView acceptance

Paul explicitly authorized this extension after the original bounded package
slice. It uses the existing `FormView`, `FieldView`, `RowView`, `parent`, `itemKey`,
`rowKey` and `removal` APIs. One FormView owns the only Core root. Ordinary Regions
and CollectionViews own placement; no extra value store or composition facade is
introduced. Server-baseline adoption, external error policy, File safeguards,
customer migration and publication are outside this change.

Each ancestor array must be crossed through its owned RowView group. Business
keys are immutable and unique within each list; repeated inner keys under distinct
outer keys are independent. List/group paths and defaults/exclusions resolve by
the entire ancestor-key chain, never a retained numeric ancestor index. Removing
an ancestor retires descendant logical state and ends detached inner placements,
widgets, nodes, listeners and pending work. Two levels are measured; arbitrary
depth, raw unowned array ancestors and direct Core graph mutation are not certified.

Construction reset remains the existing policy. Same membership retains keyed
groups and controls through both levels of reordering. Changed membership ends
placements before reset; the owner rebuilds its ordinary CollectionViews from
final construction values. Added outer and inner rows never join reset membership.
Nested edits and removals use existing native/validation settlement and async
submission cancellation; no separate submission state was added.

## Independent oracle and preserved failures

The final eight-case public source oracle is
`test/unit/formkit-nested-rows.spec.js`, SHA-256
`8c37b04cfd7a61eb779ec503bfdf6ff403a25616a4e4fb50566e8875dd366edb`.
The identical final v3 file fails **8/8** against the unchanged prior
`baab5619fcf207eb2ec1139d367dcea09c67acd2` source and passes **8/8** on the candidate.
Independent source hashes are captured before and after, and earlier attempts
remain preserved outside public artifacts.

The first candidate was **7/8**, not passed. Its pending-edit fixture used the
default disabled-submit behavior. An independent diagnostic confirmed the actual
disabled control suppressed input. The reviewer changed only that scenario to
the supported `submitBehavior: 'live'` mode and asserted enabled/unsettled input;
payload and callback assertions stayed unchanged. v3 strengthened a late-success
observer by registering it after destruction and before callback completion.
Original v1/v2 files and red results remain recoverable; they are not rescored.

Cases cover repeated local keys, two-level reorder/focus/errors and native edits,
clear/preserve/defaults through list remount, absent-list ancestor deletion/key
reuse, detached widget and delayed-input cleanup, both construction reset paths,
async validation with sibling removal before callback capture, and removal/destroy
after callback capture with signal abortion and late-result suppression.

Independent review also reproduced an existing cached-list boundary defect on the
prior source: a RowView could claim another form's already registered list. The
live/same-form/list guard now precedes cache lookup. Its unchanged independent
probe fails before and passes after, with a public regression in
`test/unit/formkit-row-boundaries.spec.js`. A separate inner-only reset probe
verifies unaffected outer/sibling identities survive.

## Delivery measurements

The final source checkpoint passes:

- Repository verify: **2,491 tests in 169 files**, build, source/declaration types,
  zero-warning lint, profile, diagnostics, API inventory, public-test and workflow
  checks.
- Configured coverage: **100% statements, branches, functions and lines** in all
  nine production FormKit modules and the isolated experiment. Policy and existing
  exceptions are unchanged. Repository totals remain 99.97% statements/lines,
  99.82% branches and 100% functions under those existing exceptions.
- Installed ESM/CommonJS: six nested and twenty existing schema/composed lifecycle
  cycles, plus keyed schema/View and value-normalizer checks, strict declaration
  consumers, package content and dependency boundaries. The seven runtime exports
  are unchanged; no Vue/React/Pro dependency or source fallback is shipped.
- Chromium **11/11**, including two-level reorder/focus, immediate native invalid
  click, associated errors, keyboard valid submit, changed membership reset and
  retained-control cleanup. The Vite production example build also passes.
- Documentation delivery: all pipeline stages pass, including the installed stage
  rerun with a process-local writable npm cache; 55 recipes, 20 type fixtures and
  15 TypeScript examples execute. No global configuration was changed.
- Independent design/code reviews, frozen eight-case oracle, cached foreign-owner
  regression, inner-only reset probe and final sibling-default case pass. An
  isolated unconditional baseline-deletion mutation fails the unchanged surviving
  sibling default assertion.

Verified production source SHA-256: `index.ts`
`bea2c8712642dab0348a0a89faec74b336fc24b19ef56a883aa33add4e38dbc9`;
`row-ownership.ts`
`5a3f3633b6a9dc6990124c267d184903bf0395aece5f9cd9366d99564fcd8fe3`.
Final source/test/policy hashes stayed unchanged between passing coverage and the
final repository verification. The committed API inventory records the full source
hash map. The current commit pointer is recorded in GOAL-STATUS.md/EVIDENCE.json.

Earlier failed attempts remain preserved. The initial build stopped at stale API
inventory after compiling source/types. The first browser launch used an empty
cache; the next run found an unsupported `children.forEach` in the example, fixed
by ordinary iteration. A native click initially missed the moving button when
blur displayed the required message; independent event/geometry probes confirmed
no submit event. Reserving error space in the example fixed the original immediate
click, which remains asserted. A separate keyboard diagnostic was not substituted
for that failed pointer case. The first installed fixture inspected callback
capture before validation settled; awaiting the public settlement boundary fixed
its setup without changing callback/data assertions.

The first two configured coverage runs passed every test but failed thresholds.
They exposed untested sibling traversal and the clear-ancestor retirement path.
The final public sibling case verifies immediate clear removal, surviving default
and exclusion state, fresh key reuse and reset. The earlier authoritative-write
version and all mutation evidence remain recoverable. No coverage exclusion,
exception, threshold or failing independent assertion was removed.

The `/nested.html` example uses invented groups/items and native labelled required
fields. It demonstrates add/remove/reorder, local submit, reset and owner cleanup.
It makes no host transport, paid-control, screen-reader speech or broader
framework-parity claim. Earlier frozen authoring and shared-schema certificates
retain their exact measured checkpoints.
