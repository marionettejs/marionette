# Evaluation rubric — Stage 1

Evaluator-only. Version 0.5, clarifying local model persistence after the navigation pilot. This does not change any frozen experiment rubric or historical grade. API constraints are source-checked; policy recommendations require assessment of the complete consumer feature. Freeze this rubric together with the concrete task requirements before model runs. The revised records example implements startup, selection, and cleanup checks. Remaining criteria are specifications for later tasks; this is not a controlled agent evaluation harness.

## Scoring and evidence

Record outcome and API-contract checks as pass/fail/U/N/A. Score each applicable policy separately for the build and extension; mixed criteria produce separate outcome and policy entries:

- **2 — established:** inspected ownership supports the stated design; any alternative has a concrete lifetime or product justification. Record required outcomes separately.
- **1 — concern:** no explicit policy is contradicted, but a decision creates a concrete coupling or maintenance concern. Cite the operation and consequence; taste alone is insufficient.
- **0 — policy violation:** an explicit architecture policy is contradicted without a justified alternative. Record the policy and direct evidence. A failed behavior check is recorded separately and does not automatically assign policy 0.
- **U — unverified:** evidence is missing or blocked. Do not treat this as a pass or average it away.
- **N/A:** the frozen task does not exercise this criterion; explain why.

Framework test setups and probe structure must never be used as the expected application design or a scoring template. Hard outcomes come from frozen product requirements and verified API contracts. Architecture policies are the intended teaching decisions below; they are not claims that alternative designs cannot work. Label each finding **outcome**, **API contract**, or **policy**.

Retain a file/line or runtime observation, reproduction/check, and rationale per finding. Class names, class counts, docs-read logs, selector counts, and green behavior tests alone do not establish architecture. No summed score determines success. Report two results for each phase:

- **Functional result:** derive pass/fail/unverified only from outcome and API-contract entries.
- **Architecture result:** derive only from policy entries: meets the declared teaching policies (all applicable policy scores 2), meets with concerns (no 0/U, at least one 1), does not meet (an explicit policy scores 0), or unverified (required policy evidence is missing).

A critical runtime failure includes an obsolete result acting on ended UI, broken required retention, or repeated active effects after their required lifetime. Safe resource retention by a surviving owner is not a leak. A policy violation may exist in functionally correct code; label it as such, without reclassifying functional success. Accept justified alternative ownership designs that protect the same boundaries.

The reference-only condition is intentionally not given the architectural guide. Comparing adherence measures whether the guide teaches these declared policies. It does not establish that every alternative architecture is objectively defective or that long-term maintainability improved. Report both results and the follow-up change evidence; do not turn policy adherence into a single success-rate claim.

Hide condition labels and documentation traces during code review where feasible; code itself may still reveal the condition. Preserve disputed findings as U until the same frozen criterion and evidence support a decision. If two reviewers are used, reconcile their original findings explicitly rather than silently averaging them. Additional model grading is not a prerequisite for this small pilot.

## Criteria

### 1. Feature effects and responsibility

**Rationale/policy:** Feature owners coordinate requests, shared feature state, and effects for their lifetime. Views render supplied state and emit intent; local interaction state may remain local.

**Evidence:** Trace a user action through feature coordination, API/service access, result acceptance, state changes, rendering, and cleanup. Confirm which object is accountable for each.

**Alternative:** A focused function or stateful object supports an explicit owner; transport and persistence can live in an API/service layer. A different data solution can satisfy the same ownership contracts. A purely local control needs no feature Application.

A View may call its own model's save operation for a local edit when the data layer supports it. An asynchronous call in a View is not by itself a policy violation. Review whether it also owns feature readiness, shared workflow decisions, or work that needs to outlive the View. Other Views observing the same model does not alone make the saving View a cross-panel coordinator.

**Superficial pass:** An Application merely constructs a View that manages feature requests and cross-panel effects.

**Check:** Code review; runtime checks cover resulting behavior, not ownership by themselves.

### 2. Composition and sibling coordination

**Rationale/policy:** Composition owners supply children with data and placement responsibilities and coordinate siblings through explicit shared state/events. This protects independent child lifetimes.

**Evidence:** Trace selection or another cross-panel action. Inspect child creation, dependencies, replacement, and disposal. Look for a child reaching into sibling internals.

**Alternative:** One owner can manage a small list/detail feature; require separate owners only for a concrete independent responsibility or lifetime.

**Superficial pass:** Sibling Applications exist but mutate one another's Views through global references.

**Check:** Review dependency paths; automate required cross-panel behavior and independence.

### 3. State authority and retention

**Rationale/outcome:** Requested selection, filter, or draft retention holds. **Policy:** Each state item has an identifiable authority and lifetime; avoid competing writable copies.

**Evidence:** Trace all writes and resets, including refresh, navigation, and invalid selection. Match retention/reset behavior to the task contract.

**Alternative:** Derived projections and transient input state are valid when synchronization and commit ownership are explicit.

**Superficial pass:** A model exists, but current selection is actually recovered from a CSS class or duplicated independently in siblings.

**Check:** Runtime assertions for specified transitions; review for authority and synchronization.

### 4. Refresh and request validity

**Rationale/outcome:** Refresh preserves exactly the shell/state required by the task; obsolete responses cannot overwrite valid current results. **Policy:** Request acceptance belongs to the effect owner's lifetime.

**Evidence:** Controlled completion order, repeated refresh, pending-request departure, and shell identity where required. Inspect invalidation and result-acceptance paths.

**Alternative:** Cancellation, invalidation, serialization, or replacement can be appropriate if all required outcomes hold and the mechanism is source-supported.

**Superficial pass:** One happy-path refresh works while an older response can win later.

**Check:** Deterministic runtime checks plus owner review. Do not assume cancellation alone prevents every late update.

### 5. Teardown and retained owners

**Rationale/outcome:** Ended lifetimes leave no active listeners, effects, or UI updates that violate requirements. Intentionally retained owners remain usable.

**Evidence:** Repeated enter/leave or replacement; count relevant callbacks/effects and inspect who releases each subscription/resource.

**Alternative:** A longer-lived owner may retain state or subscriptions with an explicit lifetime and no invalid child access.

**Superficial pass:** Visible DOM disappears while callbacks still fire or stale child references remain active.

**Check:** Runtime lifecycle probes and review of source-verified cleanup contracts; absence from the screen is insufficient.

### 6. DOM, lists, and proportional boundaries

**Rationale/policy:** Views own their DOM; framework composition owns managed child placement and list lifetimes. Boundaries should match responsibilities.

**Evidence:** Trace list insert/remove/reorder and child teardown. Review selectors and direct DOM operations for ownership violations, including parent orchestration reaching into child markup.

**Alternative:** A View may perform bounded local DOM work; a static fragment needs no extra Application or managed child list.

**Superficial pass:** Framework classes wrap manual child removal, or every small control gains an Application without an independent job.

**Check:** Review plus relevant list/lifecycle behavior checks; use no blanket selector or class-count rule.

## Build versus extension

Preserve the build snapshot and findings before revealing the extension. Grade the extension against its requirements and verify existing required behavior still holds. Separately record responsibility shifts, restructuring, interventions, and effort; fewer changed lines are not proof of adaptability. A justified redesign can succeed. A failed build does not disappear when the extension repairs it. Freeze whether blocked builds proceed and their budgets before runs. This rubric alone establishes no documentation effect.


## Source-checked interpretation

- Child Application registration establishes ownership, not activation. A parent explicitly chooses startup dependencies; `prepareStart` can await them. A required child’s `start()` resolving false needs explicit parent policy; it is not automatically a parent-start veto.
- A preparation signal protects pending readiness. Result validity during later refresh or after host loss needs application policy. The first slice returns its records promise from prepareStart and relies on framework admission to onStart. A later refresh operation needs a separate lifetime policy. Other mechanisms can earn full marks when they meet the same task boundaries. Runtime evidence for readiness: `evidence/verification-results.txt`.
- Stopping retains generic `listenTo` subscriptions and state; destroying releases framework-managed subscriptions. Gate or remove active-run effects explicitly. Borrowed state is not disposed by the borrowing View/Application.
- Region replacement normally destroys the outgoing View. Detachment can deliberately retain it. Grade against the declared retained lifetime rather than treating every hidden live object as a leak.
- Rerendering a layout or CollectionView can replace children. Require retained identity only where the task calls for it, and distinguish collection updates from full render.

The corresponding implementation anchors and actual framework checks are in `evidence/application-contracts.md`, `evidence/view-state-contracts.md`, and `verification.md`. These facts constrain interpretation; they do not expose hidden task requirements to the evaluated agent.
