# View and Region reference results

2026-09-29. This slice documents the current v5.0.0-rc.2 working tree; the [candidate report](evidence/view-region-package.json) records exact source/diff and artifact hashes. The framework runtime was not changed in this slice.

## Delivered

- A direct [API index](../../docs/api.md), [View reference](../../docs/api/view.md), and [Region reference](../../docs/api/region.md).
- Canonical shared [View runtime](../../docs/api/shared/view-bindings.md), [common](../../docs/api/shared/common.md), [events](../../docs/api/shared/events.md), and [state](../../docs/api/shared/state.md) contracts.
- Existing Application and CollectionView sections moved to their own explicitly partial pages. Removed overlapping compact-reference sections and updated inbound links; no redirect stubs.
- Candidate packaging/discovery now includes nested reference pages, checks heading links, and extracts/executes the new reference fences from the installed package.

The class pages explain public contracts independently of the records lesson. Shared methods have one authoritative location. Complete provider authoring, standalone Behavior/MnObject/Radio, and broader Application/CollectionView coverage remain visible gaps in the [inventory](coverage.md).

## Six quality dimensions

| Dimension | Result and evidence |
| --- | --- |
| Coverage | [View audit](evidence/view-reference-audit.md), [Region audit](evidence/region-reference-audit.md), and [shared audit](evidence/shared-reference-audit.md) account for constructor options, declared/inherited members, statics, extension points, hooks/events and relevant types. TypeScript-checker candidate names were cross-checked against the dispositions; static/event surfaces were also reviewed manually. Region's missing-selector recovery decision remains open. |
| Accuracy | Focused source tests passed in each audit group. All six new reference snippets execute with outcome assertions against the installed candidate; two TypeScript fences compile under strict NodeNext against installed package declarations. |
| Findability | The seven author lookup checks below have direct paths and supported answers. Candidate traversal resolves all 14 doc files, 137 relative links and 26 heading links. Removing a linked file or heading produces the intended failure. Reader success has not been measured. |
| Architecture | Existing-element composition, retained View transfer, local state, and renderer configuration are described without the records app. Source fixtures were used for behavior evidence only. These examples do not establish transfer across unseen application designs. |
| Usability | Documented fences execute and the installed quick start passes. Independent-reader build/extension/debugging performance remains unverified; no new model campaign ran. |
| Maintainability | Shared contracts are linked, moved anchors updated, and doc bytes checked against packed bytes. Full production publishing and retired-document tests still need migration; this candidate transformation does not certify that pipeline. |

## Author lookup checks

These are author checks of the final pages, not fresh-agent evaluation results.

| Question from the inventory | Path from docs index | Answer and evidence |
| --- | --- | --- |
| Adopt existing markup; what do render/destroy do? | API index → View → Existing elements / Rendering and status | Pass an Element; contents are adopted and root stays fixed. `template: false` suppresses rendering; destruction removes the adopted root and managed children. Extracted TypeScript example checks child teardown and root removal; View fixed-root/lifecycle suites cover remaining behavior. |
| Retain a Region child versus empty it? | API index → Region → Empty, detach, reset, and destroy | `detachView()` returns the live child and releases ownership/forwarding; `empty()` destroys it. Extracted TypeScript example preserves identity while moving the View and verifies teardown under the next owner. |
| Which named-Region operations render or destroy? | API index → View → Named Regions | Queries/additions avoid rendering; show/get/detach child and emptyRegions render the parent if needed. Remove destroys the Region and its child. View query/registration/child suites are recorded in the View audit. |
| Lifecycle arguments and order? | API index → View / Region → Lifecycle | Hook first, then listeners; tables identify each source and payload. Direct View destruction and Region replacement distinguish detach timing. View/Region lifecycle and monitor suites cover the source contracts. |
| UI and child intent; listener ownership? | API index → Rendering and View bindings → UI bindings / Child events → Events cleanup | UI queries are bound snapshots. Child arguments are preserved; mapped handler, mapped event, then prefix. Owners release forwarding; native destruction releases incoming subscriptions. UI/event and destruction-cleanup suites are recorded in the audits. |
| Update a View when model data changes? | API index → Rendering and View bindings → Data bindings → View rendering | Use an appropriate observable DataApi and `modelEvents: { change: 'render' }` for a small View. A layout rerender resets Regions and destroys managed children. The installed contract probe asserts both the updated title and child teardown. |
| Region replacement of CollectionView? | API index → Region → Replacing a CollectionView | Region before:show/empty wraps the outgoing CollectionView's teardown, then incoming render/attach/show. Destroy-children events belong to CollectionView. The installed contract probe asserts the hook sequence in both normal and replaceElement modes. |

## Commands and execution evidence

- View audit: **261 tests passed in 24 files**, exact command in [its audit](evidence/view-reference-audit.md#verification-performed).
- Region audit: **141 tests passed in 6 files**, exact command in [its audit](evidence/region-reference-audit.md#verification).
- Shared audit: **266 tests passed in 18 files**, exact commands in [its audit](evidence/shared-reference-audit.md#checks).

The groups can overlap; their counts are not presented as a unique total.

```sh
node planning/docs-v5/probes/package-discovery.mjs
node planning/docs-v5/probes/reference-contracts.mjs
npx eslint planning/docs-v5/probes/package-discovery.mjs planning/docs-v5/probes/reference-examples.mjs planning/docs-v5/probes/reference-contracts.mjs --max-warnings=0
```

**Passed:** 17 recorded commands; five installed candidate packages; 14 discovered docs; six new reference examples with outcome assertions, including two compiled TypeScript examples; **48 records browser checks plus 3 quick-start browser checks** across Chromium, Firefox and WebKit; both production builds. Source and installed documentation hashes match. [Full report](evidence/view-region-package.json).

The [additional contract checks](evidence/view-region-contracts.json) and lint passed. A local Markdown scan found no broken destinations or anchors across consumer/planning pages. The installed file/heading negative checks establish sensitivity to missing targets; semantic link destinations were also reviewed manually.

The snippet harness supplies JSDOM and TypeScript from repository test dependencies. Framework imports resolve in the isolated installed consumer. Its DOM example checks are not browser checks. The existing records/quick-start browser suites remain separate. The retained partial Application/CollectionView snippets are illustrative declarations and are not included in the six new standalone-fence checks.

## Remaining limitation

An allowed missing selector clears Region's cached `el`; a later `show()` or `reset()` throws `MN0004`, even after a target appears. The installed contract probe confirms this, the parent rerender consequence, skipped-show ownership, and repeated empty behavior. Current behavior is stated briefly in the Region reference; the [audit](evidence/region-reference-audit.md#known-runtime-limitation-requiring-a-recovery-decision) records the separate recovery decision. No runtime patch or example-only workaround was added.

## Independent review and disposition

Claude received the API index, six new reference pages, coverage inventory, member candidates and recorded contract/package evidence. The [review output](evidence/view-region-claude-review.json) is retained as the review of that earlier snapshot, not approval of the final revision.

- Fixed its concrete concerns about function-valued options, Region reset/el wording, shared-configuration coverage and stale section links. Added the common model-change lookup and reduced duplicated cleanup wording and CollectionView-specific detail on the Region page.
- Verified its source questions with the [installed contract probe](probes/reference-contracts.mjs): missing-selector failures, skipped-show return/ownership, function-valued data sources, and custom constructor invocation. `Parent.call` and `Parent.apply` are supported by current function constructors and declared types; retained and clarified this contract instead of classifying it unsupported.
- The detailed replacement hook sequence passes for normal and replaceElement Regions. It remains evidence for the later CollectionView reference without dominating Region's public page.
- Native automatic listener cleanup documentation depends on the earlier working-tree implementation. The candidate includes it; publish these together. This slice did not change runtime behavior.

No second Claude review of the corrected revision was requested. Final local checks establish the corrections; they do not replace independent-reader evidence.

## Next priority

Complete CollectionView's reference: sorting/filtering, empty presentation, child management and lifecycle. Reuse the shared contracts above, and select subsequent work from the inventory. This improves framework coverage without expanding the records lesson.
