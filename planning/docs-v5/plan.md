# Marionette v5 documentation and tooling plan

Updated 2026-09-30. The six core class references and runtime/provider contracts have been audited. The [coverage inventory](coverage.md) tracks remaining scope. Later clean-source Claude probes chose Application in both conditions, but exposed implementation failures and no consistent benefit from a planning prompt. These short diagnostics do not establish reliable teaching effectiveness or improvement over the older docs. Resume framework-wide delivery and coverage work; further Application-choice probes are not a prerequisite.

## Completion sequence

1. **Delivery and discovery:** migrate ordinary documentation export/build/package checks to the replacement corpus and provide a short, version-matched agent entrypoint. Verify actual package contents and reading paths. Keep planning, evaluation evidence, and test starters out of the consumer artifact.
2. **Supported reference:** complete `@mnjs/data`, then Radio, standalone utilities, adapters, errors, consumer lint, and relevant TypeScript contracts. Audit members against source and declarations; keep conflicts explicit instead of silently changing the framework.
3. **Practical guidance:** address local edits and observable updates, retained refresh, navigation, existing HTML, lists, widget integration, testing/debugging, accessibility, and migration. Use focused independent examples, selected from reader needs. Keep the records lesson bounded.
4. **Actionable tooling:** verify documented lint, type checking, diagnostic lookup, and example commands from a consumer installation. Document their actual limits. Exact-symbol retrieval needs rebuilt contract mappings before it can be advertised against this corpus.
5. **Release acceptance:** review the whole map, validate the installed package and site artifact, then evaluate reserved lookup, greenfield, extension, and debugging tasks. Record behavior and architecture separately. Greenfield tasks provide requirements, HTTP contracts, dependencies, tooling, and an HTML mount, with no authored application JavaScript. Freeze scope and budget before paid runs.

The [first parallel slice](delivery-data-results.md) delivered canonical package/site checks, agent discovery, and `@mnjs/data`. Separate file ownership kept authoring independent; integration checks ran serially because they share generated output. The [second parallel slice](validation-radio-results.md) adds Radio, simplifies onboarding, and migrates contract and documentation-fixture validation. It records retired sample coverage explicitly. The [third parallel slice](tooling-utils-results.md) completes utilities/errors references and consumer-tooling recipes, closes the two recorded Lit/list integration gaps, and fixes the public-test policy failure. Remaining API families, partial semantic groups, and practical guides follow the inventory before release acceptance. Completion means supported contracts are accounted for, common workflows are teachable, distribution and feedback tools work, and representative independent reader outcomes have evidence. Passing checks alone do not certify best-in-class teaching.

Historical evaluation proposals below describe how to design a controlled comparison; they are not the current work queue or authorization for another campaign.

## Goal and scope

Help developers and agents learn Marionette, find precise contracts, choose appropriate architecture, and build, extend, and debug applications. Keep the learning path short and the supported public reference complete.

The documentation map is driven by framework capabilities and reader needs. An example demonstrates selected concepts; its requirements do not define documentation scope. Removing the records example must leave a coherent framework documentation structure.

- Design from the v5 implementation and reader needs. Do not restore retired documentation as the starting design.
- Use proven application architecture as a conceptual model. Public work must be generic and self-contained, with no name, link, quotation, or dependency on the private reference application.
- Applications coordinate feature composition, effects, and state for a concrete lifetime. Views render supplied state, handle local interactions, and emit feature intent; Regions manage placement and teardown. A View may save its own model when the data layer supplies persistence. Additional boundaries need a reason.
- Prefer `@mnjs/data` in introductory examples, while explaining its incomplete scope and explicit API/service boundary. Support replacing the data solution through the framework contracts.
- Use ordinary renderer facilities. Avoid example-only helpers and warnings that distract from the concept being taught.
- Source tests establish API behavior. Their setup code is not an application-design reference.
- Keep evaluator tasks, rubric, and run records under this planning directory, outside consumer documentation and evaluation workspaces.

## Documentation map

| Reader need | Material | Organizing principle |
| --- | --- | --- |
| Learn the framework | Introduction, setup, short tutorial | Prerequisites and a useful first result; introduce choices progressively. |
| Understand a decision | Concepts and architecture | Ownership, lifecycle, composition, state, rendering, async work, and legitimate alternatives. |
| Look up a contract | API index and class/shared/integration references | Supported public surface, with stable headings and direct links. |
| Complete a task | Task guides | Reader goals such as existing markup, filtered lists, retained refresh, navigation, or reusable behavior. |
| Diagnose and maintain | Troubleshooting, testing, migration, deployment guidance | Observable symptoms and supported workflows. |

Reference navigation separates core classes, shared class contracts, runtime configuration, provider interfaces, and companion packages. Core class pages live in `docs/api/`; shared contracts in `docs/api/shared/`; provider interfaces in `docs/api/providers/`. Companion APIs live in `docs/packages/`, and concrete setup recipes in `docs/integrations/`. These categories describe API ownership and reader purpose. Optional packages do not become core APIs because a tutorial uses them.

Reference pages are organized by Application, View, CollectionView, Region, Behavior, and MnObject. Shared events, state, and class utilities have one authoritative explanation, linked from applicable classes. Runtime/provider and companion-package references cover their own contracts. Each class page covers purpose, construction/options, properties/methods, return values, lifecycle hooks/events, ownership, and extension points. Common operations appear first; advanced detail remains findable without dominating the learning path.

The inventory records current coverage, missing contracts, source anchors, and the next work. Its initial rows are API families and reader needs. A family becomes complete only after a member-level audit, including inherited members, options, hooks, and events. An exported TypeScript helper or implementation method is not automatically a supported consumer API; ambiguous cases require an explicit disposition.

Author guidance once. The verified candidate layout uses `docs/readme.md` beside the installed `marionette/package.json`, reached from README and llms.txt. The ordinary build/package path now exports that layout; live website import and publication remain separately unverified. Agent instructions should point to the same content and ordinary verification commands. Website rendering and additional retrieval tools follow demonstrated needs.

## Quality checks at each milestone

Use these checks when completing a coherent documentation slice. Routine wording edits need only their relevant checks; no additional approval step is introduced.

| Dimension | Check and evidence | What prevents a completion claim |
| --- | --- | --- |
| Coverage | Compare the slice with its inventory row and source/type surface. Record covered, partial, and missing contracts. | An unexplained omission within the claimed scope. |
| Accuracy | Check defaults, arguments, results, lifecycle ordering, ownership, and examples against the current version. Run the narrow relevant checks. | A material mismatch or unverified behavioral claim. |
| Findability | Start at the public index and locate answers to representative lookup questions without relying on the records lesson. Record the path and answer. | A required answer is missing, misleading, or accessible only through example knowledge. |
| Architecture | Trace ownership and explain when the recommendation applies across different application shapes. | A recommendation works only by copying the example, or introduces a boundary without a concrete job. |
| Usability | Exercise documented commands; later use isolated fresh-reader build, extension, and debugging tasks. Record intervention and failures. | Claimed reader success depends on undocumented maintainer help. |
| Maintainability | Check for duplicate authoritative contracts, stale links, version drift, and executable-source divergence. | Competing answers or examples that no longer match the supported API. |

Report dimensions separately. Mark unavailable evidence unverified and inapplicable checks N/A with a reason. Author lookup checks can establish reference completion; independent reader effectiveness remains a separate, unverified result until tested. API counts, passing tests, reading traces, tokens, and elapsed time cannot substitute for correct architecture or successful reader outcomes. Mechanical coverage can measure accounted-for contracts; it cannot establish explanation quality. No overall percentage or reviewer approval certifies “best in class.”

Before implementation of each slice, identify its inventory rows, reader question, intended scope, and smallest useful verification. At completion, update those rows and report:

- Reader need improved and remaining gaps.
- Evidence actually collected, with source/docs revision or hashes when needed.
- Peer comparison relevant to the decision, if the structure or approach changed.
- Next priority and why it matters more than extending the current example.

These notes belong in the existing inventory or milestone result. Do not create a new reporting system for each page. Checks that were not run remain unverified; later edits do not inherit exact-artifact verification automatically.

When a benchmark exposes a gap, identify the general reader decision before changing consumer docs. The guidance must also make sense for application shapes outside that task and must preserve legitimate simpler designs. Keep ticket IDs, test selectors, required output strings, and evaluator instructions out of consumer material. Record task-specific analysis only in evaluation notes. Improvement on an exposed task remains regression evidence.

## Drift and peer checks

At a structural milestone, ask:

1. Would the documentation map still work if the records example disappeared?
2. Can someone use the changed reference without reading that lesson?
3. Which framework capability or reader need are we leaving underserved?
4. Are we documenting a general contract, a recommended pattern, or a choice made only by one example?
5. Is proposed tooling fixing an observed obstacle? Is a framework change a separate, justified dependency?

For a meaningful structural decision, compare two relevant peers and record the reader problem, observed mechanism, Marionette fit, tradeoff, and evidence that would change the choice. Reuse the [peer comparison](peer-comparison.md); further research needs a concrete decision. Framework-specific compiler analysis is outside scope. Attribute combined tooling results accurately.

Independent reviews receive the overall map, coverage inventory, changed pages, and known gaps, alongside relevant implementation evidence. Ask: “Does this improve Marionette documentation as a whole, and what important reader need is being overlooked or displaced?” A review of an example cannot approve the whole documentation set. Record what the reviewer saw, returned, and changed. Use independent review for structural milestones or meaningful ambiguity, not every edit.

## Reference foundation — current

The [coverage inventory](coverage.md) maps the core public surface and development needs to current material. It includes complete omissions and partial example-specific coverage. Source links are inspection anchors, not blanket behavior verification.

The [completed slice](coverage.md#view-and-region-reference-slice) records the View/Region reference scope and checks. View and Region provide the UI composition foundation used by other classes; this slice fills their reference gaps while the wider inventory remains partial.
Continue with the remaining companion/API contracts according to the inventory. Test discovery and understanding during authoring; the corrected build/extension pilot does not need to wait for every advanced guide. Its reference condition must include every supported contract the selected tasks require.

Done for each class slice: supported members accounted for, accurate contracts, working relevant examples, direct index links, and resolved lookup questions. Done for the reference foundation: all six core classes and shared contracts audited, integration boundaries explained, and all remaining scope explicitly visible. No class is omitted because the records example does not use it.

## Concepts and task guides

Explain the framework model independently of any one application. Use small examples where they clarify a contract and runnable features where composition needs context. Preserve concise default guidance and explain necessary alternatives near the decision they affect.

The records lesson already teaches preparation, list/detail selection, retry, and close/reopen. Keep it as one maintained lesson. Choose later material from uncovered needs in the inventory: existing markup, filtered lists, retained refresh, independent lifetimes, reusable behavior, or data integration. Do not require every concept to become another records feature.

Validate claimed product behavior, ownership, and teardown separately. For each runnable guide, use the real packaged version, a documented renderer/data setup, and ordinary build/test commands. Add focused negative checks only where they establish that an acceptance test detects a claimed failure. A test fixture or a green browser suite cannot establish recommended architecture.

Reserve tasks with different application shapes before tuning guidance. Once a task is used to improve the docs, it becomes regression evidence; select a new unseen task for the next transfer check. Keep reserved task details outside authoring and evaluated-agent contexts.

## Evaluation harness

Before any model campaign:

- Install the frozen package into an isolated consumer workspace and resolve the docs through its declared entrypoint.
- Confirm the reference implementation passes relevant acceptance checks.
- Introduce a few deliberate defects, such as accepting a stale response and replacing the shell on refresh, and confirm each targeted check fails for the intended reason.
- Check how automated evidence and code review distinguish appropriate ownership from superficial framework usage.
- Test that evaluated workspaces cannot read hidden tasks, grader criteria, this planning conversation, user memory, or the private reference application.

Record the source/package revision, docs revision, scaffold revision, model and client configuration, tool access, environment instructions, time/token budget, network policy, and permitted source access before running. Provision dependencies first; keep external web/docs access disabled during the controlled comparison. If an agent client cannot isolate inherited instructions or memory, record that limitation and do not claim a clean consumer test.

## Controlled pilot

Compare two conditions with the same scaffold, available tools, installed-package discovery mechanism, and task requirements:

A. Task-relevant API reference.
B. The same reference contracts plus architecture guidance, examples, and their natural navigation.

Both conditions use the same version-verified runtime and dependencies. Keep the relevant reference sufficient for the task rather than withholding essential contracts from A. Preserve the guided package's real index and continuation links. Give A a coherent reference-only index without dangling links. Enumerate navigation changes alongside added pages in the treatment manifest; shared API contracts remain identical. This measures the combined contribution of navigation, guidance, and examples beyond that reference. It does not isolate their individual effects or measure docs versus no docs. A forced-reading diagnostic would be a separate, explicitly declared condition.

Class references include purpose and recommended ownership alongside API contracts. Keep those recommendations in both conditions. Record reference revisions explicitly; the A/B comparison measures the additional material's contribution beyond the current reference and cannot isolate the effect of those revisions from a historical run.

Proposed first pilot: one model, one build task, two conditions, three fresh starts per condition: six independent sessions. Within each session, follow the build with one unannounced extension. Keep build and extension scores separate. This intentionally measures whether the agent's own architecture supports later work; it is not an isolated measurement of extension skill. Follow-up execution and budgets must be specified consistently, including how failed builds affect the extension stage.

Use product requirements that do not prescribe class boundaries. Include a modest follow-up control that does not require another Application, to expose over-decomposition without adding a separate benchmark.

Runs are autonomous within fixed limits. Record failures, timeouts, retries, and interventions; do not silently repair or discard them. An intervention invalidates autonomous success for that attempt and is reported separately.

Score discovery, behavior, architecture, adaptation, and effort independently. Record which docs were found, but do not treat a read as proof of understanding. Keep human corrections out of successful autonomous runs. Review anonymized outputs without condition labels or traces where feasible; acknowledge that code patterns may reveal the condition. Apply the frozen rubric with concrete code and runtime evidence. Additional independent grading can be proposed if material ambiguity remains; do not commission another model reviewer automatically.

Pilot progression rules, proposed before execution:

- If discovery or harness isolation fails, repair that layer before interpreting architecture results.
- A condition has a successful session only when required behavior passes and no critical ownership/lifecycle violation remains. Also report each phase and failure separately.
- Guidance should succeed in at least two of three sessions, with no unresolved repeated critical failure, before testing generalization. A single critical failure still requires diagnosis.
- Look for a repeatable reduction in the targeted failures compared with reference-only. A three-run pilot provides directional evidence, not statistical proof or a reliable performance percentage.
- If both conditions pass, the task does not establish added value from guidance. Use a pre-reserved harder task rather than rewriting the test to force a preferred result.
- If both fail, classify the cause before expanding docs. A confirmed framework limitation requires a separate decision about API work.

## Transfer and continued improvement

After the pilot yields useful evidence, test a reserved feature with a different lifetime shape, such as a temporary modal flow or independently refreshed panels. Set aside its requirements before tuning the docs. It becomes a regression task once used to guide changes; reserve another unseen task for the next generalization check.

Then add a seeded debugging task. If build-versus-extension attribution is unclear, add an extension task starting from the same fixed implementation in both conditions. These are staged follow-ups, not prerequisites for the first six-session pilot. Freeze and agree their budgets before execution.

Classify failures as discovery, explanation, example, feedback, API difficulty, agent limitation, or evaluation defect. Change the smallest responsible part and rerun affected comparisons. Prefer replacing confusing material to accumulating warnings.

Continue closing the framework-wide coverage inventory while using trial failures to improve the relevant material. Trial tasks do not determine which public APIs deserve documentation. Any later comparison with historical docs is a separately stated decision after the initial design, not part of this plan's first stages.

## Follow-through

Choose each subsequent slice from the remaining reference and reader needs in the inventory. Package installation and discovery checks are rerun when their inputs change. Retired-document tests and the production documentation pipeline need their own migration work before a clean release claim.

Before a paid or model-based comparison, make the task, rubric, reference coverage, isolation, model/client, tools, and budget concrete and obtain the required configuration approval. Existing example tests and Claude reviews do not establish teaching effectiveness. Local commits on `docs/v5-reset` preserve reviewed increments; publishing and pushing require separate authorization.

## Upstream comparison checkpoint — 2026-09-30

The initial independent design is complete enough for a read-only coverage comparison.
The [current reassessment](adapters-guides-results.md) compares reader needs against
upstream v5 at a fixed revision. Prioritize migration and runnable consumer testing
before treating this corpus as a complete replacement. Run an effectiveness comparison
only after freezing compatible documentation conditions against the same runtime;
existing branch runtime differences prevent a clean docs-only branch comparison.
