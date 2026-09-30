# Documentation comparison follow-up

This is the current queue after the upstream comparison and Claude assessment on
2026-09-30. Keep the framework-wide structure and optional data boundary. Consumer
docs must stand on their own without the records lesson or private application
references. Checked items require linked evidence; passing checks do not establish
better teaching.

## Work checklist

- [x] **1. Freeze a retrieval baseline before changes.** Independently select
  representative reader questions and acceptable contract sections without reading
  the ranking code. Record exact corpus/search/question hashes, first-result and
  top-five section precision, answer evidence, returned characters, broad-page
  results and missing answers. Validate expected answers against the current corpus.
  Keep this question set outside consumer docs. Once exposed to authors, it measures
  regressions rather than unseen transfer.
  [Frozen results and limits](evidence/lookup-baseline-20260930/README.md): 15 questions,
  exact replay and independent metric review completed; 9 existing focused tests passed.
- [x] **2. Decide runtime integration scope.** Compare the reset runtime with frozen
  upstream `74534f719e9ae6bf00fb6061e9f8cb712e92e2ef`. Account for the extra terminal
  cleanup guarantees and Behavior handling; do not duplicate an upstream fix already
  present. Identify what belongs with the docs delivery and what needs a separate
  runtime change. Existing focused tests are evidence, not a reason to skip scope review.
  [Disposition and source delta](evidence/runtime-integration-scope.md): keep the
  committed terminal cleanup fix, reconcile upstream overlap once, and preserve
  bounded failure semantics. Independent audit and 40 focused tests passed.
- [x] **3. Restore installed exact-symbol lookup.** Resolve the six nonconsumer
  utilities README references to canonical consumer contracts, export the symbol
  index, and test generation with real metadata. Verify installed export/member/type
  lookup across entrypoints, ambiguity and unknown symbols. Preserve one authoritative
  corpus; do not ship extra README material merely to satisfy the index.
  [Restoration and checks](tooling-delivery-results.md#exact-symbol-lookup-restoration):
  131 exports across 9 runtime entrypoints; real-metadata and fresh installed lookup
  passed. Two partial reference groups remain explicitly open.
- [x] **4. Improve natural-language retrieval.** Use the frozen baseline to assess
  relevance and unnecessary context separately. Fix demonstrated ranking problems
  without query-specific rules or wording inserted to satisfy these questions.
  Rerun the same screen and report gains and regressions; symbol lookup remains a
  separate capability.
  [Matched comparison and limits](evidence/ranking-comparison-20260930/README.md):
  expected section first 1→9 of 15, returned text reduced 77.4%, with remaining
  misses and three older-query rank regressions recorded. 37 focused tests and
  final installed checks passed; Claude review informed ordering and test fixes.
- [x] **5. Complete the bounded Application reference gaps.** Clarify destination
  binding and completion-hook reentry using current source contracts. Check the
  existing binding/restart tests before adding coverage. Link the owning reference
  rather than repeat the contract in each guide.
  [Source/test mapping and verification](application-results.md#binding-and-completion-follow-up):
  binding and completion reentry now have short owning sections; existing behavior
  tests provide the evidence. No runtime or example change was needed.
- [x] **6. Complete two general workflow explanations.** First reserve independent
  unseen reader tasks outside the authoring context, before writing these examples. Add executable async
  navigation with an explicit retained-screen or child-transition policy, and local
  draft/save handling with failure preservation. Validate overlap, cancellation,
  teardown and save failure as applicable. Keep live editing distinct; a local View
  may own a save. Do not invent persistence APIs for `@mnjs/data` or add helpers solely
  for example completeness.
  [Workflow results and limits](workflow-results.md): three independent tasks reserved
  before guide edits; two actual examples added; 48 fences, 15 packaged browser
  checks and final fresh installed verification passed. Three deliberate defects
  were detected. Reader effectiveness remains unmeasured.
- [x] **7. Simplify the quick-start acquisition path.** Move maintainer build/tarball
  preparation aside so the consumer reaches a useful application quickly. Preserve
  truthful candidate/released installation guidance and verify the documented path.
  This small independent edit can proceed alongside tooling after step 1.
  [Acquisition results and limits](acquisition-results.md): consumer setup starts
  from supplied artifacts; exact installation/build commands, installed discovery
  and three browsers passed. Public registry acquisition and reader effectiveness
  remain unverified.
- [x] **8. Verify affected delivery and compare fresh-reader outcomes.** Run the
  package/discovery checks affected by these changes; align the website import and
  tools with the exact candidate artifact. Freeze a small same-runtime comparison
  using independently authored, unseen tasks and matched model/tool access/budgets.
  Declare whether the comparison measures older versus revised docs or the added
  guidance beyond current reference; these answer different questions. Specify
  whether tooling is held constant or part of the treatment.
  Score behavior, lifecycle ownership, unnecessary scaffolding and discovery
  separately. Record intervention and uncertainty. Keep publication/deployment and
  runtime upgrade decisions explicit; no published label without registry evidence.
  [Preparation and exact delivery](reader-preparation-results.md): both corpora are
  frozen; website import, common ranking and local retrieval are verified. The
  comparison uses upstream v5 versus rebuilt docs with common tooling. Qualification
  passed and the first cohort ran: one pair passes under both corpora; a third
  attempt reached its tool cap and lost final accounting, leaving three unstarted.
  [First-cohort results](reader-comparison-results.md) preserve all outcomes.
  The separately authorized [second cohort](reader-comparison-v2-results.md)
  completed the two remaining task pairs with accounting retained: both conditions
  pass required behavior, API and applicable ownership criteria. Delivery omissions
  and inaccurate explanation wording remain separate. The cohorts are not pooled.
  This bounded local-delivery/comparison step is complete; improved reader
  effectiveness remains unestablished. Live publication/deployment and real consumer
  migration remain separate acceptance gates.

## Efficiency follow-up after the reader pilot

- [x] Audit recorded reading and helper failures without exposing reserved tasks.
- [x] Tighten entry guidance and repair demonstrated focused-lookup friction.
- [x] Verify affected delivery and run one small independent before/after reading
  screen. [Results and limits](efficiency-results.md): required correctness passed
  in all four answers; reading volume improved for one request and regressed for
  the other. No product helper use was observed.
- [ ] Establish consistent reading efficiency and lower application-build time/cost.
  The current evidence does not satisfy this objective. Pause corpus expansion;
  do not tune docs to the exposed reader requests or mark this complete from static
  checks. On 2026-10-01 the user authorized a bounded repeated comparison after
  routing/coverage corrections. Preparation and execution are delegated to the
  independent review chat; [scope and candidate identity](efficiency-results.md#routing-and-coverage-follow-up)
  are recorded. The [eight-attempt results](reader-comparison-v3-results.md) preserve
  seven completed and one limited submission, all 80 passing required behavior
  checks, and mixed efficiency. Consistent savings remain unestablished.

## Evidence and limits

- Starting revision: `b1a2b39e6bde6ce5605b0cfff00f9408652f4b39`.
- Assessment: 9 focused documentation tests and 54 focused lifecycle/Application
  tests passed. Symbol coverage was synthetic; real metadata generation failed.
  Those results do not measure reader effectiveness.
- Claude assessment: retained the structure, separated symbol lookup from ranking,
  and recommended closing reference contracts before dependent examples. Several
  proposed runtime tests already exist and passed in the focused rerun.
- Deferred unless a concrete reader need appears: full router modules, a custom-store
  tutorial, a broad index schema redesign and additional convenience helpers.

Keep results here or in a linked evidence record. Update this checklist as each
bounded step completes; do not expand it into another documentation architecture.

## Progress reassessment after step 5

2026-09-30. A read-only subagent checked the actual index, ownership guidance,
local editing, navigation, tooling and evidence. Claude reviewed the reference diff
and remaining sequence. We remain aligned with the original framework-wide goal:
the class/shared/provider/package references and task paths stand independently of
the records lesson. Optional data and local View work have explicit boundaries.

**Strong evidence:** source-backed contracts, packaged discovery, exact symbols and
locally exercised recipes. The same exposed lookup questions improved under the
new ranking algorithm, with misses and regressions recorded. Those results belong
to their frozen snapshots; they do not prove unseen-reader outcomes.

**Remaining uncertainty:** practical clarity and independent build/extension success.
No best-in-class or improvement-over-older-docs claim is established. The previously
proposed reference-only versus guided comparison would estimate added guide value;
it would not answer the older-docs comparison. Peer structural reviews are useful
context, not comparative reader-performance evidence.

**Scope boundary:** finish one async transition policy and one draft/save workflow
in the existing guides, then simplify acquisition. Do not add a router, generic
persistence helpers, another retrieval tuning round or a custom-store tutorial
without a demonstrated reader need. Reserve independent tasks before those edits;
freeze authoring afterward and run the declared small comparison once. Use its
observed failures to choose further changes. Verify changed delivery against the
exact artifact; live publication, deployment and real consumer migration remain
separate acceptance gates.

Confidence is high in the framework structure and audited contracts, moderate in
practical usability, and unestablished for improved unseen-reader effectiveness.

Claude identified repeated prose and a subsection that accidentally included the
inherited-API paragraph; both were corrected. Its requests for contract checks and
claim-to-test mapping were satisfied with focused checks and existing tests. The
review was supplied before those check results were available; its suggested
missing tests largely already existed. See the linked step-5 result for the final
commands and review record.
