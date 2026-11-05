# Independent router improvement scope

Base: `a613f8de3a7c5a9a4d9aebe42a5f04b64b3ac6d0`, inspected with canonical origin
on 2026-11-05. Origin master remains `2828aebdc928a2e8121ee5f601a2d5012412068e`.
The published candidate, d45 recovery ref and private recovery artifacts remain
unchanged. Work stays local on `codex/router-independent-improvements` for review.

The complete supplied decision review and Claude follow-up were read as evidence,
not implementation commands. Their source claims still need local verification.

## Selected work and rationale

- Reproduce mutable structural keys and asymmetric sparse-array comparison using
  actual Applications. Capture a structural value snapshot when `switchTo` is
  called, before lifecycle callbacks. Keep primitive `Object.is` semantics,
  nested values, arrays (including distinguishable holes), and plain records.
  Reject unsupported/cyclic values before changing selection. Do not freeze or
  mutate caller data. Allow readonly arrays in the public type. Document the
  concrete value domain and compatibility/cost boundary.
- Correct cancellation/readiness language. Route completion observes returned
  handler work, not detached work or every Application replacement. A fulfilled
  false is not automatically routing cancellation.
- Supply an import-safe capability recipe tested before eager construction.
  Account for URLPattern, native Navigation API, AbortSignal.any,
  Promise.withResolvers and URL.canParse; individual optional tools may need fewer.
  Presence checks do not certify browser behavior. No fallback driver or app error
  screen is added.
- Add a small separate installed consumer with two feature-owned RouteApplications,
  shared `routeParent`, lazy registration followed by refresh, and UI ownership
  distinct from URL ancestry. Its self-restarting primary page owns a stable
  initial-presentation promise, including handled error/stop outcomes. Test shared
  preparation, supersession, owner stop/destroy and late failures without rollback.
- Make ordinary onboarding short, keep advanced contracts accessible, and clarify
  commit/completion/native results/focus policy, default runtime family, restricted
  grammar, stop/start versus instance replacement, and marked Back behavior.
- Scrutinize the actual candidate with independent read-only adversarial reviews,
  address justified findings, then run fresh applicable full checks and available
  native browser checks. Keep historical results distinguishable.

## Deferred deliberately

No app-frontend or FormKit edits, overlay policy changes, app startup refactor,
CircleCI edits, automatic branch-to-Application walker, nested lifecycle engine,
framework-neutral rewrite, grammar expansion, leave guards/history compensation,
new core lifecycle factory, speculative public status API or optional API pruning.
App CircleCI's missing local router smoke remains an app integration follow-up.
Source rights/license provenance remains a release gate; router stays private.
No public branch update, PR, merge, package release or deployment is part of this
candidate preparation. Return exact heads and review/verification results first.

## Investigation and review decisions

The before-fix Application suite ran 28 cases: 19 failed, 9 passed. This includes
six demonstrated supported-value failures (three mutation/timing cases and three
sparse-array cases), plus the newly specified unsupported-input rejection cases.
The latter are conformance to the chosen value domain, not a claim that invalid
JavaScript inputs previously had a rejection guarantee. Snapshot timing, value
validation and sparse equality repairs pass those tests and existing selector races.

Adversarial key review found exponential expansion of supported aliases. A public
switcher graph with 29 unique records exhausted a bounded 64 MiB heap before the
fix (exit 134). Snapshot and successful-pair equality memos resolve this; the same
bounded public probe passes with differing sharing layouts in both directions.
The reviewer rechecked ancestor-before-cache cycle rejection, authority retention,
shared-leaf mutation, memo lifetime and cost, and found no remaining substantive
key issues. Caller data is neither frozen nor modified. Same-realm acyclic data
containers are explicit; unsupported object types/descriptors are rejected before
intent changes. This retains the previous declared primitive/structural value
domain and adds readonly array acceptance rather than narrowing keys to scalars.

A separate adversarial consumer/contracts review found no supported issues in
stable replacement readiness, handled presentation, owner teardown, late work,
capability gating or optional registration. Both reviews were read-only. Review
feedback is supporting evidence, not a substitute for fresh final-head checks.
Exact final results are supplied in the candidate handoff; earlier integration
results in `test/router/README.md` remain historical.
