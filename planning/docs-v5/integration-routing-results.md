# Existing UI and navigation

## Delivered scope

Two independent reader guides extend the framework-wide task map:

- [Existing UI](../../docs/guides/existing-ui.md): host-owned mount, Region-owned content, callback communication, synchronous cleanup, and the boundary for Application-owned asynchronous features.
- [Navigation](../../docs/guides/routing.md): initial fragment selection, destination replacement under a retained shell, unknown routes, title/focus policy, Back/Forward and Application-owned Window subscription cleanup.

Both use class-scoped Lit configuration. Neither requires a data package, service injection or example-only correctness helpers. The local counter is a View owned by a Region; navigation warrants an Application because it coordinates destination lifetimes and a global subscription. No runtime, declaration, dependency or records-example change was needed.

The navigation example leaves focus alone at startup and focuses the heading on subsequent destination changes. Its synchronous route dispatch does not define asynchronous transition, persistence or unsaved-change policy. The existing-UI guide links the tested Application lifecycle for async work and explains the host's obligation to coordinate cleanup completion.

## Review

The review-with-Claude skill received the two guides, actual-fence outcome assertions and browser spec. Its [retained review](evidence/integration-routing-claude-review.json) found no confirmed product bug, but requested clearer async verification scope, title assertions and a focus decision. The async section was shortened around the canonical lifecycle and existing consumer cancellation test; title assertions were added; startup no longer moves focus. A redundant asynchronous post-stop test was replaced with explicit callback counting. Both Node and browser checks now require zero route callbacks after stop and one after restart.

Claude's review assessed its supplied snapshot. Its statement about completed browser coverage was not evidence of a run: actual results below come from our executed checks. We did not add a defensive route handler for calls after stop, because only the running Application's startup and subscribed navigation use this method. We did not duplicate the existing lifecycle cancellation test as a third integration example. JSDOM scenarios each run in separate processes, so their URLs do not leak between examples.

Two intermediate browser failures came from the test harness: adding an export for a function already exported by the guide, and a callback-counting wrapper dropping the new focus argument. Both were corrected before final validation. The guide code required no change for those failures.

## Evidence and limits

Final verification:

- `npm run docs:check` passed: seven export tests, 43/43 actual independent fences, 15 TypeScript fences and 20 declaration fixtures. [Installed report](evidence/integration-routing-installed.json): 34 consumer pages, seven tooling checks, the five-test consumer recipe with its cleanup mutation, and the four-example TypeScript guide with six rejected invalid edits.
- `npm run test:browser -- test/browser/docs-guides.spec.mjs` passed **15/15** checks across Chromium, Firefox and WebKit, with no retries or skips. [Browser summary and source hashes](evidence/integration-routing-browser.json).
- API-contract and retrieval tests passed **16/16**; scoped ESLint and whitespace checks passed.
- Site build/link validation passed for the final content. API inventory consistency passed; the seven existing partial groups remain open.

These checks establish executable delivery and the illustrated mechanisms. They do not establish independent reader effectiveness, a working React/custom-element integration, path-router behavior, or async navigation policy. There was no paid evaluation, publication or full runtime-suite run.

## Assessment

Strengths: direct task discovery, explicit lifetime boundaries, compact runnable examples, actual Markdown execution, and browser verification of history/focus/cleanup. Routing decisions remain with the owner; shell identity survives ordinary destination replacement.

Weaknesses: the mounted feature has only synchronous cleanup; integration with a real host framework remains unverified. The navigation recipe covers fragment routing and synchronous pages. Async transitions and server path fallbacks need validation in an actual consumer. Correct code and working discovery do not show whether a fresh reader will apply the ownership model.

Next authoring priorities are production behavior and accessibility/rendering trust boundaries. The controlled reader comparison remains a separate measure of effectiveness; it should use frozen docs against the same candidate runtime and tools.
