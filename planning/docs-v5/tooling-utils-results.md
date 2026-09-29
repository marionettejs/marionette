# Utilities, consumer tooling, and integration verification

2026-09-30. This continues the [Radio and validation slice](validation-radio-results.md).
The previous verified work was checkpointed as `0c458a69`; this slice uses three
parallel tracks with disjoint ownership and one integrated documentation check.
No framework runtime or declaration implementation changed. The records example
was not expanded or changed in this slice.

## Delivered

- [Utilities reference](../../docs/packages/utils.md) covers standalone exports,
  argument/result contracts, component methods, event helpers, and types. Existing
  Events and shared class explanations remain canonical through links.
- [Errors and diagnostics](../../docs/api/errors.md) covers MarionetteError,
  supported metadata, native Error behavior, and installed diagnostic lookup.
- [Consumer tooling](../../docs/tooling.md) provides executable lint and TypeScript
  configurations, diagnostic lookup, and a short public-API debugging workflow.
  The guide explicitly states analysis limits and leaves architecture decisions
  to ownership reasoning and behavioral review. Installation checks caught and
  corrected constructor-versus-instance typing in the TypeScript example.
- The private-state policy failure is resolved: cleanup tests now check event
  delivery, notification order, unrelated subscriptions, and whether surviving
  listeners revisit released sources through the public `off()` API. This is
  observable cleanup evidence, not a deterministic heap-reachability test.
- The two recorded installed integration gaps have focused tests in the existing
  DOM-adapter fixture: an external Lit host with a Region-owned Lit child, and
  CollectionView subscription accounting across structural changes and teardown.
  These tests have independent fixtures and do not restore the retired teaching
  examples or prescribe application architecture.

## Verification

| Check | Result |
| --- | --- |
| Utility/error and shared-helper source tests | 107 tests passed in 13 files. |
| Destruction/listener source tests | 25 passed; no private-member assertions. |
| `npm run check:public-tests` | Passed; previous policy failure resolved. |
| `npm run check:api-contracts` and its focused tooling suite | Passed; 10 tooling tests. Inventory regenerated after reviewing source/documentation changes. |
| `npm run docs:check` | Passed: 7 export tests, 29 executed reference/setup examples, 20 declaration fixtures, 10 TypeScript examples, 25 packaged pages, 71 HTML files and 883 internal links. Fresh installed discovery and content integrity passed. |
| Installed consumer tooling | Seven checks passed: valid lint/type examples, meaningful invalid controls, restored valid examples, and installed diagnostic lookup. Uses the packaged page's actual fences. |
| Installed `dom-adapters-package` fixture | Passed: both new scenarios in ESM and CommonJS, existing Lit/Morphdom checks, and TypeScript 6/7 compilation. Frozen candidate identities are recorded in its report. |
| `npm run lint:ci`; `git diff --check` | Passed. |

Evidence: [installed docs/tooling report](evidence/tooling-utils-installed-package.json),
[utility/error audit](evidence/utils-errors-reference-audit.md),
[tooling recipe audit](evidence/consumer-tooling-audit.md), and
[integration verification](evidence/integration-verification.md).

The installed integration candidate predates the new documentation pages; runtime
and declaration bytes were unchanged. The separate final docs check verifies the
new pages and tooling from freshly packed artifacts. Reports retain those exact
identities rather than combining them into a claimed release candidate.

The earlier full unit/tooling/browser counts belong to the preceding milestone.
This slice reran the checks relevant to its changed contracts. Full release
validation, live publication, and independent reader outcomes were not run. No
additional Claude review was used; the focused implementation and tests did not
leave a concrete tradeoff requiring another review round.

## Assessment and next work

The semantic inventory now reports **45 documented groups and 11 partial groups**.
Eleven utility/error groups gained references; this is a set of reviewed coverage
dispositions, not a percentage of API completeness or teaching quality.

Strengths: the API map is broader, executable tooling catches useful mistakes,
and integration ownership is verified independently of a tutorial. Public tests
no longer couple cleanup claims to private field names. Authoring stayed separate
from evaluation prompts and the records lesson.

Limits: optional adapter guidance, comprehensive TypeScript guidance, lifecycle
reentry details, and practical task guides remain incomplete. Mechanical success
still does not prove that readers choose the right owners or solve new tasks.
The lint rule intentionally cannot make those decisions. Integration evidence is
JSDOM/package evidence, not a new real-browser focus or performance claim.

Next bounded work: optional adapter references alongside short local-editing,
retained-refresh, and existing-HTML guides. Keep each guide independent and verify
its actual installed code. Use reserved independent reader tasks once their needed
contracts are available, without adding instructions tailored to an exposed test.
