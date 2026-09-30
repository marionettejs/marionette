# Async navigation and local draft/save results

2026-09-30, follow-up checklist step 6. Two independent examples extend existing
guides. The simpler first examples remain. No runtime, dependency or records-lesson
change was needed.

## Delivered

- [Async navigation](../../docs/guides/routing.md#route-to-asynchronous-features):
  the parent retains the shell and owns URL dispatch; a managed child prepares the
  destination. Stop precedes the next start, the newest navigation wins, and loading,
  content and errors share one Region. The error View exposes an actual Retry event.
- [Local draft/save](../../docs/guides/local-editing.md#keep-a-draft-until-save-succeeds):
  a View owns its draft and API request. Only accepted data updates the borrowed
  Model. Pending input is read-only while controls retain focus; failures preserve
  the draft and allow retry. Teardown invalidates late completion.
- The index describes both workflows. The existing executable-fence harness runs
  them unchanged; its browser loader can select the second example explicitly.

API endpoints and response shapes are stated prerequisites. Optional `@mnjs/data`
supplies observable attributes, with fetching and persistence supplied separately.
Navigation stop is unconditional in this example; no stop-veto, full router or
shared draft/conflict system was added.

## Independent reservation

A separate author reserved **three tasks before the guide authors began edits**.
The [author-safe manifest](evidence/reader-reservation-20260930.json) records hashes,
paths and release order. Root and guide authors did not read the task contents.
The same-user filesystem boundary is procedural. Existing API wording was already
changed; historical-doc compatibility, runnable seeds and exact model/tool/budget
settings still need execution preflight. This reservation is not a completed model
evaluation or a fully isolated test environment.

## Verification

| Check | Final evidence |
| --- | --- |
| Actual documentation fences | [48/48 executed](evidence/workflow-examples-20260930.json), with 20 declaration fixtures and 15 TypeScript examples. Controlled transports deliberately ignore abort for stale-result checks. |
| Fresh installed candidate | [Passed](evidence/workflow-installed-20260930.json): discovery, lint/type recipes, consumer tests and all 48 fences against five installed local tarballs. |
| Packaged browser interaction | [15 checks passed](evidence/workflow-browser-20260930.json) across Chromium, Firefox and WebKit, with no skips, failures or retries in the final run. Checks include real Retry, Enter submission, focus/caret retention, continued editing after failure, duplicate submission and native fetch abort on teardown. |
| Check sensitivity | [Three deliberate defects detected](evidence/workflow-negative-controls-20260930.json): commit a draft before API acceptance, replace the shell during navigation, and omit the latest-navigation check after child stop. Temporary copies were mutated; canonical sources were unchanged. |
| Native event cleanup | 25 existing `destroy-listener-cleanup.spec.js` tests passed, including replacement under a retained Application. No manual destroyed-View `stopListening` bridge was added. |
| Delivery consistency | Seven export tests, contract inventory, affected JavaScript lint, documentation build and 1,104 internal links passed. Inventory remains 55 documented groups and one partial custom-store group. |

The final installed content digest is
`33e325d89adf6cc37304b3b26bd8cdf2b52814369388b3f605950a74b832b6a3`,
with `sourceDirty: true` at `b1a2b39e6bde6ce5605b0cfff00f9408652f4b39`.
We matched its digest and guide hashes to local package staging. The final browser
test assertion refinements affect test files only; consumer bytes match that digest.

Commands:

```sh
npm run check:docs-examples
node scripts/api-contracts/check.mjs --write
node scripts/api-contracts/check.mjs
node --test test/docs/export.test.mjs
npx eslint test/docs/reference-examples.mjs test/docs/draft-save-checks.mjs test/docs/async-navigation-checks.mjs test/browser/docs-guides.spec.mjs --max-warnings=0
npm run docs:build
node scripts/docs/check-links.mjs
npm run docs:package
npm run check:docs-installed
npm run test:browser -- test/browser/docs-guides.spec.mjs --grep 'Documented (local editing|draft|asynchronous navigation|navigation handles)'
npm test -- test/unit/destroy-listener-cleanup.spec.js
git diff --check
```

The first pass caught an incorrect assumption that parent destruction aborts child
requests synchronously; assertions now distinguish immediate authority revocation
from subsequent child traversal. A later keyboard assertion used `End`, which did
not move the caret consistently on macOS browsers; it now uses the known caret
position and ArrowRight. The final runs passed after those test corrections.

## Claude review

[Initial review](</Users/paulfalgout/.ai-reviews/20260930T090415Z-review-with-claude.md>)
received both guide diffs, outcome checks, goals and the available verification.
It confirmed ownership boundaries but found that same-hash clicks did not reach
retry, and that disabled controls could lose keyboard focus. We added a Retry View
event, made pending input read-only with a focusable `aria-disabled` Save button,
tested real actions, and shortened the prose. Save commits remain outside the
transport-failure catch.

[Follow-up review](</Users/paulfalgout/.ai-reviews/20260930T091738Z-review-with-claude.md>)
found no blocking ownership or contract issue, conditional on final checks. Its
minor requests led to explicit read-only/ARIA assertions and pending duplicate
submission coverage. Its possible error-View listener leak was checked against
source and the 25 existing cleanup tests; native destruction already releases it.
The final test assertion refinements were verified locally after that review.

## Assessment and next step

**Strength:** the guides now demonstrate concrete failure, retry and lifetime
policies with actual user interactions and checks that detect meaningful defects.
They preserve legitimate local View ownership and give Applications concrete jobs.

**Limits:** controlled HTTP is not live API integration. Drafts end with the View;
they do not survive navigation or resolve concurrent external edits. The async
example demonstrates an unconditional transition policy, not every router behavior.
No unseen-reader outcome, comparative framework effectiveness, registry publication
or live deployment claim is established.

Next is checklist step 7: simplify acquisition. Then freeze authoring and perform
the declared independent comparison after preflight, keeping the reserved tasks
outside the authoring context. Further material needs a demonstrated reader need.
