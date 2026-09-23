# RC.1 stabilization checklist

Tracking record: [issue #574](https://github.com/marionettejs/marionette/issues/574).
Update dated results in that issue; the unchecked items below describe required evidence.

## Objective

Prepare `5.0.0-rc.1` from the published beta.6 runtime, certify its exact artifacts, and use the RC as the fixed target for the remaining stable-release evidence. This issue does not declare stable readiness or authorize `5.0.0` publication.

## RC entry requirements

- [ ] Review current supported-workflow failures; resolve any confirmed critical library defect.
- [ ] Provisionally freeze the public API; document limitations and require another RC for contract changes.
- [ ] Align all five package versions, internal dependencies, agent plugin, documentation, and prerelease policy.
- [ ] Review/merge preparation and certify the exact final commit/tarballs on every supported host/browser.
- [ ] Before dispatch, record publication authorization and the successful manual certification run ID.

After publication, complete package/tag/provenance verification and the matching
website/MCP handoff in the [release checklist](./release-checklist.md).

## Stable exit requirements during RC stabilization

- [ ] Record the start and end of seven consecutive days after the published candidate is installed in the selected consumer workflows. Record application revisions and which workflows each owns; calendar time alone is insufficient.
- [ ] Verify startup/error UI, latest navigation/load/save completion, rejected-stop screen preservation where supported, repeated restart/teardown, updates, draft/focus/selection, and overlay cleanup. Keep unit, browser, live-service, and retention evidence distinct.
- [ ] Close or explicitly disposition consumer acceptance gaps with evidence; publish anonymous reproductions for private findings. Do not require complete private migration or complete Vue removal.
- [ ] Freeze a bounded fresh-agent maintenance policy before collection; record build/change/repair/handoff outcomes and interventions. Model, permissions, attempts, spend/time envelope, and authorization remain required before paid runs. Existing migrations and known solutions are supporting evidence, not scored attempts.
- [ ] Record matched lifecycle/state/collection timing and retention checks; investigate meaningful regressions. A dedicated machine is not intrinsically required if matching conditions and variance are documented. Validate focus/identity preservation before accepting a sorting-cost tradeoff; do not trade correctness for timing.
- [ ] Resolve supported critical workflow defects; revalidate relevant fixes against the final candidate. Contract changes require a new RC and stabilization period; other changes require an explicit impact/evidence-refresh decision.
- [ ] Certify the distinct final `5.0.0` commit and publish only after its separate authorization. An RC certificate cannot certify different stable-version bytes.

## Evidence status at preparation

- Public library source/tag: beta.6 at `18e21435fa21f75bf4a5067a210dec2ea7e0bccc`; no subsequent runtime change at preparation.
- Public consumer: Vikunja beta.6 adoption at `0ef01d3d186c058b4aa6dedfbede974412dac489`, CI https://github.com/marionettejs/vikunja/actions/runs/35756578282 . Green aggregate CI includes a tolerated typecheck failure and one browser retry; full clean acceptance is not inferred.
- Maintainer-local consumer acceptance and branch-performance reports are supporting observations. They do not establish public reproducibility, full acceptance equivalence, independent agent success, or retention. Keep private code and raw logs out of this issue.
- No new confirmed beta.6 library defect was established by the reviewed reports. Unresolved attribution/coverage must remain explicit.

## Issue ownership

The tracking record maps stable acceptance, delivered-surface evidence, and
optional post-launch work to their existing issues. It must keep uncollected
evidence open rather than treating issue counts as readiness.
