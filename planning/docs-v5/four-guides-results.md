# Production, accessibility, lists and controls

## Delivered

Four independent task guides complete the agreed authoring slice:

| Reader task | Guide and evidence |
| --- | --- |
| Build and deploy | [Production](../../docs/guides/production.md), [source audit](evidence/production-guide-audit.md). Installed packages, provider scopes, startup ownership, server routes and deployment checks. Prose links existing executable recipes. |
| Make interaction accessible and render text safely | [Accessibility and rendering](../../docs/guides/accessibility-rendering.md), [audit](evidence/accessibility-guide-audit.md). Native keyboard controls, retained nodes, owner-selected replacement focus and text/raw-HTML boundaries. |
| Show and manipulate repeated rows | [Lists](../../docs/guides/lists.md). Local View controls, Region/CollectionView ownership, sorting, filtering, empty presentation and draft/identity limits. |
| Integrate an imperative control | [Widgets](../../docs/guides/widgets.md), [audit](evidence/widget-guide-audit.md). Real native dialog APIs and cleanup before render, detach and destruction; Behavior reuse links the direct-disposal contract. |

The examples use native ownership rather than extra Applications, service injection, helper utilities or a fake widget. Data is optional and explicitly incomplete for API/persistence needs. No runtime, declaration or dependency changes were introduced. The existing records lesson was unchanged. The guides join website navigation, installed docs, llms.txt, consumer task routes and both skill copies.

## Reviews and corrections

Subagents authored production, accessibility and widgets independently; a subagent source-reviewed the lists guide and checks. The parent integrated delivery and actual-fence browser testing. The read-only review found no list ownership defect and identified that a no-new-rows assertion alone cannot prove cleanup.

The review-with-Claude skill received all four guides and the three new assertion modules, with combined verification explicitly pending. Its [retained review](evidence/four-guides-claude-review.json) supported scope and architecture but found a vacuous late render spy: named handlers bind before the instance spy was installed. Instrumentation now precedes View construction. An intentionally unmanaged callback to a destroyed row is rejected; the clean and restored checks pass ([sensitivity evidence](evidence/list-cleanup-sensitivity.json)). Its suggested DOM-text-only replacement would miss an attempted render blocked by a destroyed View, so that replacement was not used.

We shortened repeated startup-failure prose, removed an unnecessary collection reassignment warning and internal UI-query explanation, and clarified that `baseline widely available` is this repo's actual transpilation query. Claude's suggestion to replace it with Vite's differently spelled target would misstate the inspected package/profile. The native DOM `innerHTML` claim was confirmed in `src/runtime/dom-api.ts`. The dialog has a valid accessible name without introducing shared heading IDs. Both reference and task-guide lookup remain checked.

New guide content displaced an existing exact-reference ranking for a task-shaped list question. The retrieval assertion now verifies the task guide's actual identity/presentation answer; a separate `setComparator viewComparator` question still requires the canonical Sorting contract. The docs were not rewritten to fit the ranking.

Browser tests initially assumed Tab would reach buttons in macOS WebKit and that mouse activation focused the dialog opener. Tests now use the platform's keyboard traversal and open the dialog from a focused button before checking focus return. No example workaround was added. [Apple's keyboard contract](https://support.apple.com/en-jo/guide/safari/cpsh003/mac) supports the Option-Tab choice. All three browser engines execute actual packaged Markdown fences.

## Validation

Executed results:

- `npm run docs:check` passed, including seven export tests and **46/46 actual reference/guide fences**, 15 compiled TypeScript fences and 20 declaration fixtures. [Installed report](evidence/four-guides-installed.json): **38 consumer pages**, seven tooling checks, five consumer tests and their cleanup mutation, and four strict browser TypeScript examples with six rejected invalid edits.
- `npm run test:browser -- test/browser/docs-guides.spec.mjs` passed **24/24** checks across Chromium, Firefox and WebKit, with no retries/skips. [Browser report](evidence/four-guides-browser.json) records package and example hashes.
- API-contract and retrieval tests passed **16/16**. Scoped ESLint, API inventory consistency and whitespace checks passed. The semantic inventory still records 49 documented groups and seven partial groups, not completeness percentages.
- Final site build/link validation passed: 83 documentation pages built, 84 HTML files and 1,099 internal links checked.
- The list cleanup probe passes clean/restored and rejects the injected unmanaged callback; no production source was mutated.

These are authoring and mechanism checks, not a docs-effectiveness score or release acceptance.

## Strengths and limits

Strengths: the four tasks have direct discovery paths, compact examples and links to canonical contracts. List input identity, keyboard activation, explicit transition focus and control closure before removal are checked through actual consumer-facing code. Production avoids vendor-specific infrastructure prescriptions and points to existing tested setup.

Limits: production remains guidance, with no new deployment/cache/server exercise. Native dialog checks do not certify a third-party editor/chart package integration. Keyboard/focus/text checks do not establish assistive-technology coverage or application accessibility conformance. Large-data choices, persistence, actual migration and independent reader effectiveness remain unverified. Seven prior semantic groups remain partial.

Next: one bounded completeness/consistency pass, including declaration examples and stale status, then consumer and controlled reader validation. Add further pages only when a concrete reader need warrants them.
