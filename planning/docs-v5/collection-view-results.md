# CollectionView reference results

2026-09-29. Scope: complete the CollectionView consumer reference using the current `5.0.0-rc.2` working tree. Runtime behavior is unchanged in this slice. Earlier staged deletions and destruction-cleanup work remain intact.

## Delivered and scope

The [CollectionView reference](../../docs/api/collection-view.md) covers construction, collection updates, child identity, sorting/filtering, empty presentation, child-container queries, manual ownership, lifecycle, extension points and types. Shared contracts remain linked to their canonical pages. The [API index](../../docs/api.md), documentation index and llms.txt expose the class directly.

The standalone list uses native data and Lit, independently of the records lesson. It demonstrates a small CollectionView without inventing an Application or persistence layer. No new framework helper, renderer, retrieval service or runtime fallback was added.

## Quality checks

| Dimension | Evidence and limit |
| --- | --- |
| Coverage | [Member audit](evidence/collection-view-reference-audit.md) accounts for own/inherited options, methods, events, extension points, child-container queries and exported types, with internal dispositions. Provider authoring remains separate. |
| Accuracy | 524 tests passed in 16 focused files; exact command in the audit. New standalone TypeScript fence is included in the existing installed-package extraction/compilation/execution probe. Final package results recorded below. |
| Findability | Author lookup checks below start from the public index. They establish available answers, not independent-reader success. |
| Architecture | Rows own local rendering; CollectionView owns repeated composition and lifetime; Region owns the list. Source tests establish behavior only. |
| Usability | Executable snippet checks are bounded evidence. No fresh-reader build/extension comparison ran. |
| Maintainability | Existing extraction and discovery probes cover the new page; shared contracts are linked, and partial coverage remains visible. Production publishing and retired-docs tests remain separate work. |

## Author lookup checks

| Reader question | Path from API index | Supported answer |
| --- | --- | --- |
| How do I show a list with native data? | CollectionView → Render a collection | Configure child/list DataApi and the child's renderer integration, provide childView, and show the list in a Region. |
| Will filtering or sorting destroy my row state? | CollectionView → Rendering and collection updates / Filtering | Filtering retains hidden children; sorting retains surviving instances. Full render/reset rebuilds rows. |
| Does a stable key guarantee the same View? | CollectionView → Rendering and collection updates | A same-key replacement object gets a new child; native Model keys are cid. |
| How do I find a child or render an empty result? | CollectionView → Find and inspect children / Empty presentation | children exposes presented rows; getEmptyRegion exposes the separate empty View. All-filtered can be empty. |
| How do I transfer a manual child? | CollectionView → Manage View instances directly | detachChildView returns a live unowned View; give it a new owner or destroy it. Source membership remains unchanged. |
| Which owner emits child lifecycle hooks? | CollectionView → Lifecycle and extension points | Tables identify CollectionView hooks/payloads and distinguish full render, source reconciliation and direct removal. |

## Peer comparison

The [peer comparison](peer-comparison.md#collectionview-reference-check) checks list identity and update explanations in current React and Vue documentation. It supports teaching lifetime alongside display operations. Their key semantics are not treated as Marionette contracts or evidence of equivalent teaching effectiveness.

## Verification

Commands run:

```sh
node planning/docs-v5/probes/package-discovery.mjs
node planning/docs-v5/probes/reference-contracts.mjs
npx eslint planning/docs-v5/probes/reference-examples.mjs --max-warnings=0
```

[Installed-package report](evidence/collection-view-package.json): **passed**, 17 commands, five candidate packages, 14 documentation files, seven executed reference examples including three compiled TypeScript examples. The existing browser suites passed **48 records checks and 3 quick-start checks** across Chromium, Firefox and WebKit; both production builds passed. No skips, failures, or retries. Source documentation bytes match installed package hashes. Discovery rejects deliberately missing files/headings.

The new CollectionView example checks retained identity after filtering and additions, safe model-change rendering, empty presentation and replacement, reset destruction, manual child transfer, and owner teardown. The [additional contract probe](evidence/collection-view-contracts.json) also passed, including CollectionView replacement hook order. These JSDOM contract/example checks are distinct from browser checks. Peer examples were inspected, not executed.

Lint passed. A final local Markdown scan found no missing paths or anchors in 441 links across consumer and planning pages. The package probe performs its own installed-doc traversal. The retained member audit records the separate 524-test source run; these counts are not a unique combined test total. The full unit suite was not rerun; its previously recorded retired-doc missing-file failures remain unresolved.

## Independent review

Claude received the new page, API index, whole coverage inventory, member audit and draft results. The [review](evidence/collection-view-claude-review.json) found no confirmed API error in the page. It correctly withheld completion while its snapshot still showed package verification pending and a stale next-priority section; both were updated while the review ran. Referenced index and peer-anchor edits existed but were omitted from its bounded input list, and local/installed link checks confirm them.

Applied its useful reader-facing suggestions: the example now adds a model and visibly reorders it, manual-child ordering is explicit, retained lifecycle arrays require a copy, and configuration links point to shared contracts. Removed unnecessary internal-implementation commentary. Source inspection confirmed stable criteria ordering/undefined placement, isEmpty's role in presentation, getState availability in initialize, and selector-only childViewContainer resolution. The snippet checks now explicitly verify stable/undefined sorting and the absence of parent refilter/resort on native model attribute changes. Full provider-authoring coverage was not added.

The final package probe was rerun after these edits. The retained review applies to the submitted snapshot, not a second review of the corrected revision.

## Known limits and next priority

`RegionClass` appears in the configuration type but is not copied from constructor options. The reference documents the working prototype/initialize hook; aligning that type is a separate runtime/types decision. The earlier Region missing-selector recovery issue remains outside this slice.

Complete Application next: it owns feature lifecycle and composition, and its current reference covers only part of that public surface. Full provider interfaces and a fresh-reader trial remain visible in the [coverage inventory](coverage.md). Reference completion does not certify the whole documentation set or its effectiveness.
