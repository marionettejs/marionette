# Committed baseline

Historical commit-time status. See [delivery, agent discovery, and native data results](delivery-data-results.md) for the current working slice and remaining release blockers.

2026-09-29. Integration branch: `docs/v5-reset`. These commits preserve work in progress; they do not establish release readiness or documentation effectiveness.

- `e306ca7b`: native destruction releases incoming subscriptions after final notifications, with regression tests and changelog guidance.
- `0173d44f7`: rebuilt consumer reference, concepts, setup, records lesson, runnable example, and the existing documentation/skill reset. The two DOM declaration-test comments clarify the existing contract without changing assertions.

The docs rely on the preceding destruction cleanup. Keep that dependency explicit when reviewing or moving these commits.

## Verification at commit time

- 73 tests passed across destroy-listener-cleanup, mixins/destroy, behavior-lifecycle, region-lifecycle, and destroying-views.
- `npm run check:types` passed.
- ESLint passed for the six changed runtime files and the new cleanup regression suite.
- All 33 consumer documentation and example files matched the hashes in `evidence/concepts-package.json` before committing. One trailing blank line was then removed from `docs/api/shared/common.md`; no other consumer content changed in the baseline commit.
- Whitespace checks passed for the runtime and consumer-doc commits.

The earlier installed candidate package check recorded 12 reference examples, 16 declaration fixtures, production builds, and 51 browser checks. Those are historical results tied to that report's hashes, not freshly rerun checks. The full unit suite and production documentation pipeline were not rerun here. The earlier full unit result includes ten missing-document failures in docs-integrations-examples; production documentation tooling still needs migration to the replacement corpus.

## Latest effectiveness result

Stringent's `docs/docs-v5-20260929-navigation-v2-results.md` records the completed schedule for frozen bundle `ebb4d89be7ec4fac400fa9a9cff75079d5ee2f2aa8789c04ed193d23676c4b6a`. Evidence remains in that repository under `runs/docs-v5-20260929-navigation-v2-live/` and its separate architecture-review directory.

Three of six trajectories were valid, leaving one complete reference/guided pair. The other three hit the Claude session limit; their starter snapshots are not documentation failures. All three valid trajectories failed architecture acceptance at both checkpoints. The valid guided candidate passed all browser checks and read the records lesson and example, but made its root View own feature loading and shared-state coordination. No measured `read_document` call opened the architecture guide; shell tracing is incomplete.

This does not establish reliable improvement from the guidance. Inspect the saved traces before spending more model allowance. Changes to docs or interpretation require a new frozen condition; preserve the original run and findings. No further live run is authorized by these commits.

## Next review boundary

Future focused PRs target `docs/v5-reset`. Record the question each change addresses and the evidence needed to assess it. Keep correctness checks, architectural judgments, and teaching effectiveness separate. The existing results documents describe their historical stages; this page records the status when the baseline was committed.

## Subsequent ownership clarification

The owner clarified that a View saving its own model from a local input can be appropriate. The concepts guide and rubric version 0.5 now distinguish local persistence from feature readiness and shared workflow coordination. This prose change follows the evaluated baseline; the saved package/browser results do not test its teaching effect. Original Stringent conditions and grades remain unchanged.

## Framework-wide reassessment before the next diagnostic

Scope: current documentation map, all reference section maps and lesson-independent navigation, changed ownership guidance, setup, accepted records Application composition, evaluation plan/rubric, and existing package/publishing boundaries. This is a design and evidence reassessment, not a new exhaustive audit of every API member or proof of teaching effectiveness.

| Stated goal | Assessment and remaining work |
| --- | --- |
| Framework-wide docs, independent of one example | The six class pages, shared contracts, concepts and setup form a coherent map. All 18 non-lesson consumer pages are reachable without the records lesson or source. Setup now explains its own integration choices without making the lesson a prerequisite. |
| Idiomatic v5 architecture | Preparation, feature ownership, Region composition, observable updates and lifecycle boundaries are explained. Local model/API saves remain legitimate. The accepted records architecture is unchanged. Independent transfer remains unproven. |
| Complete and usable API reference | Core class/provider surfaces have recorded audits. Radio, companion APIs, diagnostics, TypeScript, migration and task guides remain incomplete; no claim of complete framework docs is justified yet. |
| Simple explanations and proportionate abstractions | This slice changes prose and links only. It adds no runtime helper, model implementation, extra Application or lesson feature. Precise failure contracts stay in the reference. |
| Workable, replaceable data integration | Setup states the incomplete scope of `@mnjs/data`; View guidance now explicitly supports a local API call plus model `set`. It does not invent `Model.save` in that package. |
| Agent discovery and useful tooling | Installed candidate Markdown has a verified discovery path. The reset skill files still contain only frontmatter, and production publisher/navigation and retired-doc tests remain unfinished. These are delivery gaps, separate from the isolated candidate diagnostic. |
| Evidence beyond passing examples | Browser behavior, architecture judgments and retrieval are separate. The valid guided trace received the Application reference before coding; motivation is unavailable. No inference that a skipped measured read proves non-reading. |
| Avoid teaching to the benchmark | Consumer edits explain ownership decisions that also apply to local controls, visual layouts and independently managed features. No task IDs, selectors, expected outputs or queue implementation enter the docs. Exposed-task improvement is regression evidence; reserved transfer remains outside authoring. |
| Compare with peers fairly | The peer record compares explanation structure with official React/Vue guidance, preserving local state until a concrete coordination need appears. No peer runtime or agent outcome ranking is claimed. |

Author checks retain legitimate alternatives: a visual layout can use Views/Regions; a local edit can persist through its model/API; several consumers can observe a shared model without adding an Application solely for observation; a feature with readiness and shared workflow decisions gets an Application. These checks are reasoning about the teaching policy, not new independent reader results or reserved evaluation tasks.

### Claude review and changes

The [review](evidence/ownership-claude-review.json) received the goal, full plan/inventory/rubric, proposed diff, key consumer pages, remaining reference section maps, accepted Application example, tooling gaps, and trace findings. It returned a conditional go for a docs-only diagnostic and judged the direction general rather than benchmark mimicry.

Applied: shortened duplicate retention advice, added the discoverable `Operations after start` heading, clarified local API persistence with `@mnjs/data`, and updated rubric version 0.6 and the plan to state that both conditions share ownership recommendations in the reference. Package and link checks follow the final edits.

Not adopted as prerequisites: a new full filesystem tracer, another runnable refresh example, or production pipeline repair before this bounded candidate comparison. Existing measured reads can establish exposure; incomplete shell tracing remains an explicit limit. A separate retained-operation guide remains a real coverage gap, to prioritize alongside the other reader needs rather than expanding the records lesson to match the task. The review's suggestion that missing local-save guidance caused the previous design is a hypothesis, not supported causal evidence.

### Decision and next work

The final [installed candidate check](evidence/ownership-package.json) passed on 2026-09-29: 12 executable reference examples, 16 declaration fixtures, 48 records browser checks and three quick-start browser checks across Chromium/Firefox/WebKit, and both production builds. Core tarball SHA-256: `4b33eb85221a813f8cdbc15c6fc8fd39c8858697c6c6760e54e3b03fdd2854e4`. All 33 consumer/example file hashes match that package. The [static check](evidence/ownership-static-checks.json) verified local links/anchors, lesson-independent navigation, no benchmark/private-example content in consumer pages, and unchanged executable fences. This reruns candidate packaging, not the production publisher or full unit suite.

The structure remains aligned with the stated goals, but the full documentation/tooling product does not yet meet all of them. Proceed only with a bounded diagnostic of the revised candidate after package verification and a frozen proposal. Both conditions receive identical improved class references. The comparison measures the extra guide/examples/navigation beyond that reference; historical differences cannot isolate this prose revision's effect.

Stringent is preparing one reference and one guided build/extension trajectory under the previous per-stage limits, with a proposed $12 CLI-estimated allowance. This cannot satisfy the earlier two-of-three progression rule or establish generalization. Preserve the old run and grades. After the diagnostic, choose the next slice from the full coverage inventory; production publishing/retired-doc tests and an actionable agent entrypoint remain delivery priorities. Further live candidate calls require approval of the specific frozen run.
