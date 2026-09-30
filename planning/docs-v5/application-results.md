# Application reference results

2026-09-29. Scope: Application public reference for the current `5.0.0-rc.2` working tree. No runtime change in this slice. Earlier staged documentation deletions and destruction-cleanup changes are preserved.

## Delivered

[Application reference](../../docs/api/application.md) covers constructor options, lifecycle methods/results, preparation and cancellation, restart versus retained refresh, child management, root/Region ownership, state/Radio, hooks and exported types. The API index, documentation index and llms.txt link directly to it. Shared contracts retain their authoritative pages.

The example gives the Application an asynchronous request to own, then renders supplied data in a View. It is independent of the records lesson. Its `/summary.json` response is a stated prerequisite; the verification harness stubs that boundary and records the stub with its results. No application helper or framework fallback was added.

## Six quality dimensions

| Dimension | Evidence and limit |
| --- | --- |
| Coverage | [Member audit](evidence/application-reference-audit.md) accounts for configuration, own/inherited APIs, hooks, types and internal exclusions. Radio channel/provider authoring remains separate. |
| Accuracy | 276 focused tests in 15 files passed. A separate shared Radio run passed 13 tests in 2 files. Exact commands and scope are recorded in the audit. Installed example verification is recorded below when complete. |
| Findability | Author lookup paths below cover readiness, cancellation, restart and ownership without requiring the records lesson. Independent reader success remains unmeasured. |
| Architecture | Application owns feature readiness and activation, View owns rendering, Region owns placement. Passing source fixtures are contract evidence only. |
| Usability | The example is compiled/executed against installed packages with controlled HTTP; live service integration and fresh-reader transfer are not certified. |
| Maintainability | Existing snippet/discovery tooling is extended, shared definitions are linked, and framework gaps remain visible. Production publishing and retired-document tests still need migration. |

## Author lookup checks

| Reader question | Path from API index → Application | Answer |
| --- | --- | --- |
| Where does required asynchronous work belong? | Prepare before showing UI / Preparation, cancellation, and failure | Return it from prepareStart; onStart receives the result. Returned notification Promises are not awaited. |
| Can restart retain the layout and inputs? | Restart and retained UI | Restart destroys roots and starts another run. Refresh retained UI explicitly, or restart the feature child while keeping the surrounding parent. |
| Does parent start await child startup? | Child Applications | No automatic child activation/readiness. Register for lifetime, then start explicitly and handle its Promise. |
| Does a rejected operation restore the old UI? | Preparation, cancellation, and failure | No rollback guarantee. Startup preparation, onStart, stop and terminal failures leave different states. |
| What do cancellation and result false mean? | Lifecycle methods and results / Preparation, cancellation, and failure | Superseded or blocked operations can resolve false; a false preparation result is not a veto. Completed preparation signals are not lifetime signals. |
| How do I construct, find and remove a child? | Child Applications | Declarations or addChildApp register it, query methods return it, removeChildApp destroys it asynchronously. |
| Which roots/Regions does teardown own? | Root View and Region | Prepared and tracked displayed roots are cleaned up; constructed Regions are owned, supplied Regions borrowed. |
| Which subscriptions are active while stopped? | State and Radio | stateEvents are gated by activity; ordinary listeners and Radio bindings are not. Destruction releases owned subscriptions/replies. |

## Peer check

[React and Vue comparison](peer-comparison.md#application-reference-check) supports placing obsolete-response handling beside asynchronous work. Application-specific restart, ownership, and preparation rules were verified against Marionette. This is structural inspection, not an effectiveness ranking.

## Verification and review

Commands run:

```sh
node planning/docs-v5/probes/package-discovery.mjs
node planning/docs-v5/probes/reference-contracts.mjs
npx eslint planning/docs-v5/probes/reference-examples.mjs --max-warnings=0
```

[Installed-package report](evidence/application-package.json): **passed**. It records 17 commands, five candidate packages, 14 discovered documentation files, eight executed reference examples, four TypeScript examples, and the existing Application ESM/CommonJS type fixtures compiled with strict NodeNext against installed declarations. Both production builds passed. The existing browser suites passed 48 records checks and 3 quick-start checks across Chromium, Firefox and WebKit without skips, failures or retries. Documentation and snippet-harness hashes match the verified snapshot.

The Application example checks successful preparation/rendering, root replacement on restart, retained state/Region, stopped cleanup, request rejection, shared pending-start Promise, aborted preparation signal, ignored late response, and final Region destruction. The JSON report includes the test-only fetch stub and exact outcome assertions. These are JSDOM/controlled-response checks, not live HTTP/browser coverage for this new snippet. The [existing contract probe](evidence/application-contract-checks.json) also passed.

Lint and all 482 scanned local Markdown links passed. The source runs remain separately recorded: 276 Application-focused checks, plus 13 shared Radio checks. No full-unit-suite or teaching-effectiveness claim is made; the previously recorded retired-docs missing-file failures remain separate work.

### Independent review disposition

[Claude review](evidence/application-claude-review.json) received the Application page, whole coverage inventory, member audit, draft results, and the actual changed-file list. It found no confirmed contradiction with the audited lifecycle, root, child or state/Radio contracts. Its evidence blockers concerned the in-progress snapshot: installed example compilation/execution is now recorded, and the existing Application ESM/CommonJS type fixtures are also compiled against installed declarations.

The subagent's three prior requests were incorporated: failed restart/onStop states in the failure section, preparation-signal scope in cancellation, and one-time/replacement child declarations in the options table. Claude prompted more precise destroying/destroyed wording, explicit failed-restart behavior, and a clearer TypeScript statement distinguishing instance-result inference from hook parameter annotations.

Source backing resolves its remaining questions: `setView`/`showView` use `isTerminal` (destroying or destroyed); `application-prepared-view.spec.js` tests their no-op behavior during before:destroy. The installed example assertions now also exercise a no-Region Application adopting existing markup and removing it on stop. View's existing-element contract is linked. The final package probe is rerun after these corrections; the stored review remains a review of the submitted snapshot.

## Next priority at the initial pass

Complete Behavior and MnObject, then the runtime/provider and companion-package references according to the [coverage inventory](coverage.md). A short standalone concepts guide and a controlled fresh-reader trial remain important gaps; finishing class references alone does not establish best-in-class documentation.

## Binding and completion follow-up

2026-09-30, checklist step 5. Two short sections in the owning reference now explain
[destination binding order](../../docs/api/application.md#destination-binding-order)
and [restart from start completion](../../docs/api/application.md#restart-from-start-completion).
The new sections link existing rules rather than repeat cancellation, destination
ownership or root teardown. No runtime, example or test source changed.

| Claim | Existing evidence |
| --- | --- |
| The requested destination is visible before startup notifications and preparation; startup receives its options unchanged. | [Binding tests](../../test/unit/application-start-region.spec.js): `binds before startup notifications and forwards the complete options object`. |
| Rebinding waits for the restart stop phase or reused stop readiness. | Same file: `changes a restart host only after the previous host has stopped`, `waits for an adopted stop before binding a superseding start host`; [start implementation](../../src/modules/application.ts) awaits stop readiness before replacing the Region. |
| Reused stop preparation retains its original options and signal. | [Lifecycle tests](../../test/unit/application-lifecycle.spec.js): `transfers stop readiness without aborting its signal`. Startup options forwarding is covered separately above; the implementation supplies the newer operation's options after the reused readiness. |
| Stop failure leaves the prior destination bound. | Binding tests: `does not bind a new host when the stop phase fails`. |
| Restart from onStart or a start subscriber begins a separate cycle with independent options and Promise. | [Restart completion tests](../../test/unit/application-restart-completion.spec.js): generated cases `starts a distinct cycle from onStart with its own options and root teardown` and `starts a distinct cycle from start event with its own options and root teardown`. |
| A completed outer restart stays successful if the next cycle fails or is canceled. | Same file: `keeps a completed restart successful when its completion-triggered cycle fails` and `keeps a completed restart successful when its completion-triggered cycle is canceled`. |

### Focused verification

Commands run after the final prose changes:

```sh
npm test -- test/unit/application-start-region.spec.js test/unit/application-restart-completion.spec.js
npm test -- test/unit/application-lifecycle.spec.js -t 'transfers stop readiness without aborting its signal'
node --test test/docs/export.test.mjs test/agent-docs/lookup.test.mjs
node scripts/api-contracts/check.mjs --write
node scripts/api-contracts/check.mjs
npm run docs:build
node scripts/docs/check-links.mjs
npm run docs:package
node skills/marionette/scripts/docs.mjs --package-root .package --symbol Application.restart
node skills/marionette/scripts/docs.mjs --package-root .package --section 'docs/api/application.md#L159'
node skills/marionette/scripts/docs.mjs --package-root .package --section 'docs/api/application.md#L190'
git diff --check
```

- **30 runtime tests passed:** 29 binding/restart cases plus the selected readiness-transfer case. The targeted invocation deselected 58 unrelated cases; no full lifecycle-suite claim is made.
- **28 documentation/lookup tests passed:** real-metadata export and CLI/package integrity/lookup checks.
- Contract regeneration and consistency check passed: **55 documented groups, one partial custom-store group**.
- Documentation build passed; link checking validated **84 HTML files and 1,104 internal links**.
- Package staging exported **38 consumer pages**. `Application.restart` contract results link both new sections, and both section reads returned the expected text. The member's short mention list is capped at five; the full contract list remains available.
- The staged content digest is `c993298d643993b25be57ff904ddc4495cce30199aaccddac701871f2a8c31c8`, with `sourceDirty: true` at `b1a2b39e6bde6ce5605b0cfff00f9408652f4b39`.
- Diff whitespace check passed.

 Earlier installed-tarball
reports apply to their snapshots; this slice uses regenerated local package staging.
A full installed-tarball check and runtime rebuild were not needed for these prose
and metadata changes. Reader effectiveness remains unverified.

### Claude review

[Review record](</Users/paulfalgout/.ai-reviews/20260930T083806Z-review-with-claude.md>)
received the Application prose diff, current guide/index content, goals, remaining
checklist and the 29-test result. It agreed with the remaining bounded scope but
requested less repetition, corrected subsection placement, linked contract evidence
and delivery checks. We shortened the prose, moved the inherited-API paragraph out
of the new subsection and added the source/test mapping above. Existing tests cover
the proposed lifecycle cases; we did not duplicate them. The review predates the
final check results and final prose reduction, so it is not an approval of those
final bytes.
