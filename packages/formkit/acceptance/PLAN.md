# FormKit composed forms acceptance plan

Current bounded completion, open product requirements and external blockers are
reconciled in [GOAL-STATUS.md](GOAL-STATUS.md). The separately authorized nested
RowView extension is specified in [NESTED-ROWS.md](NESTED-ROWS.md). Historical
first-slice and frozen authoring trial boundaries remain unchanged.

Goal contract version 4 reconciles G6 with the independently reviewed explicit-root-data boundary on 2026-10-12. G6 and G7 were added at Paul's explicit request. G1–G5
and the frozen v8 authoring packet remain unchanged; that cohort does not cover
the new portability/values binding goal. Implementation follows independent
review of the separate versioned contract.

Frozen starting checkpoint: `fd45998e35a88c15620ae13c59271f0128ce2157`.
This is scoped local work. No push, publication, release, deployment, repository
settings change, credential change, or TCM migration is authorized.

The following gates define completion. Record failures, repairs and exact replay
evidence in `EVIDENCE.json`; never relabel an assisted attempt as an independent
first attempt. Reviewers may expose missing correctness cases within these gates;
new product scope requires an explicit separate decision.

## G1: One coherent composition model

One FormView owns the root, submission and reset. Ordinary Views and CollectionView
own placement. FieldView owns one input/group/list; a reusable SchemaView borrows a
live parent and owns its renderer resources; named schema components own real
Marionette Views through Regions. DOM nesting does not choose a data parent.

Prove one native form root containing all five routes, each canonical value and
validation exactly once, independent simultaneous same-named forms, deterministic
duplicate ownership rejection, JSON schemas with runtime named registrations,
stable keyed updates and explicit identity replacement. Keep the registration
manifest experimental and unexported. Publish no parallel convenience API without
a concrete capability gap.

## G2: Repeated rows and lifetime

Three keyed object rows, each with a nested object, support add, insert, reorder,
edit, terminal removal, temporary UI unmount and remount. Values, array order,
errors and retained defaults must follow the business key. Document construction
baseline and membership-changing reset, with no shared mutable defaults.

Exercise values before mount, delayed mount, detach/reattach, replacement, duplicate
placement, intermediate-owner destruction, form destruction, stale callbacks,
listener cleanup and unrelated host survival. The original first-slice gate froze
nested array ownership and arbitrary direct Core mutations. A later explicit
request authorizes two-level custom RowViews through the existing composition
API; its independent contract and red/green evidence are in NESTED-ROWS.md. It
does not expand the frozen v8 authoring trial or authorize raw Core graph writes.

## G3: Submission atomicity and representative flow

Submit waits for coherent native edits and validation. Pending callbacks cannot
commit success or errors after a structural/value change, reset or destruction.
Test reverse-order validation, row removal/replacement/reordering while validation
or submission awaits, cross-section and cross-row rules, double submit and failure
recovery. Define cancellation/retry semantics explicitly.

One synthetic Chromium journey maps fields, actor-only conditional state, repeated
follow-ups, tabs/sections, app-owned actions and async errors to inspected actual
TCM capabilities. Private source and evidence stay local. Genuine licensed Pro
widgets and unavailable host services are separate external gates; no credential
creation, key exposure, vendor patch or claimed full TCM rewrite.

## G4: Paired authoring comparison

After the public API is frozen, predeclare framework-neutral BUILD and held-out
CHANGE assertions. Fresh participants use matched inherited models, time/tool
budgets, dependencies and source access. Permit idiomatic Marionette and Vue
solutions. Replay unchanged submissions independently with runtime errors and
unhandled rejections as hard failures. Preserve assistance and failed attempts.
Report each pair without a broad productivity or superiority claim.

## G5: Delivery and accessibility

Document all public types, ownership, values, reset, async and cancellation
semantics with runnable examples. A clean installed artifact compiles documented
typed consumers and loads every advertised format through public exports.
Chromium checks labels, keyboard operation, focus continuity, error association
and announcements, native semantic controls and cleanup. Run repository-required
checks and configured coverage without threshold or exception changes.

## G6: Shared schema and data semantics

A byte-identical plain JSON-compatible schema must behave equivalently under
normally installed Vue FormKit and mnjs/formkit for the explicitly supported
shared slice: data references including `$values`, nested groups, repeated keyed
rows, ordinary validation, reset, programmatic form updates and external schema
data updates. Mounting/lifecycle adapters and separate trusted named-component
implementations may differ; schema content and expected semantic outcomes may not.
Verify actual adapter data semantics before implementing an alias. A local-group
rename is not evidence of equivalent root-bound values.

Form-owned updates must refresh conditions through existing node subscriptions
without manual whole-form render. Arbitrary external JavaScript object mutations
are not promised automatic observation: document and test the explicit supported
schema-data update API. Keep ordinary Marionette templates/renderers unchanged,
with no Vue/React/Pro runtime dependency, second value store or invented ancestor
aliases. Check scope/name collisions, keyed reorder/replacement, reset, detached
placements and terminal subscription/listener cleanup. Preserve 100% FormKit source
line/branch coverage and existing policy. Unsupported capabilities, actual host,
paid controls and broad framework parity remain explicit limits.

The prospective semantics and concrete cases are in
`SCHEMA-PORTABILITY-v2.md` (v1 remains preserved). Independent contract review precedes implementation;
prior frozen cohorts retain their exact artifacts and conclusions.

## G7: Simplify after correctness

After the revised supported behavior is verified, independently review duplicated
state, lifetime ownership, unnecessary abstractions, experimental code and reuse
of verified shared Core contracts. Simplify the implementation and coherent public
API where that review finds concrete opportunities. Preserve meaningful behavior,
cleanup, installed/type/browser checks and 100% FormKit source line/branch coverage;
do not lower policy, remove a failing outcome or golf source merely to reduce LOC.
Counts compare source scope, not feature parity or implementation quality. Existing
frozen authoring evidence and pre-cleanup checkpoints remain recoverable.

## Milestone review and exit

Independent reviewers challenge the model before public integration, then replay
the combined correctness gates, then review final installed/documentation/browser
evidence. Locally complete only when every local gate is recorded passing at one
identified checkpoint, or a precise external blocker is recorded for a required
external stage. A green earlier checkpoint is not completion.
