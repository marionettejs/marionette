# Legacy documentation fixture migration

The documentation reset removed the examples consumed by 18 installed-package
fixtures. Those fixtures tested extracted sample implementations as well as core
behavior. They are retired with their samples. The independent runtime suites
remain; the mapping below identifies related coverage, not assertion-for-assertion
equivalence. No previous sample pass is credited to the new documentation.

Paths in the coverage column are relative to `test/unit/` unless stated otherwise.
The current executable references run through `test/docs/reference-examples.mjs`,
including against installed packages. Core unit tests alone do not prove installed
package behavior or teaching effectiveness.

| Retired fixture | Native guarantees retained elsewhere | Sample-specific coverage retired or still missing |
| --- | --- | --- |
| `docs-application-guides` | `application-preparation.spec.js`, `application-state-events.spec.js`, `application-restart-completion.spec.js`, `application-child-lifecycle.spec.js`, `view-lifecycle.spec.js`; current Application/Events reference examples and declaration fixtures | Counter, form save/retry/draft/focus, widget workspace, active effects, API feed, resource cleanup, security/testing recipes, and their combined asynchronous completion scenarios need new guides and accompanying checks. |
| `docs-application-state` | `application-state.spec.js`, `application-state-events.spec.js`, `state-owner.spec.js`, `application-root-view.spec.js`, `application-ownership.spec.js` | Removed state/child/root communication samples no longer execute. |
| `docs-basics-contract` | `view-constructor-options.spec.js`, `common/get-option.spec.js`, `view.renderer.spec.js`, `view.triggers.spec.js` | Removed class-configuration sample; current View/Common reference examples cover the new teaching material. |
| `docs-behavior-host` | `behavior-dependencies-contract.spec.js`, `behavior-ui-contract.spec.js`, `behavior-communication-contract.spec.js`, `behavior-lifecycle.spec.js` | Removed save-control and injected-collaborator sample compositions. |
| `docs-collectionview-child-ownership` | `collection-view/collection-view-children.spec.js`, `collection-view/collection-view-lifecycle.spec.js`, `destroyed-add-child-view.spec.js` | Removed repeated child detach/re-adopt demonstration. |
| `docs-common-contract` | `common/get-option.spec.js`, `common/merge-options.spec.js`, `common/bind-events.spec.js`, `common/bind-request.spec.js` | Old options/owner-bindings fences retired; current Common reference executes its own examples. |
| `docs-dom-api` | `runtime/dom-api.spec.js`, `view-el.spec.js`, `region-el-validation.spec.js`; current runtime/DOM provider reference examples | Removed plain-text partial-override sample. |
| `docs-entity-events` | `mixins/delegate-entity-events.spec.js`, `behavior-composition.spec.js`, `behavior-dependencies-contract.spec.js` | Removed combined View/Behavior entity-rebinding sample. |
| `docs-hosted-view` | `region-adoption.spec.js`, `region-lifecycle.spec.js`, `dom-adapters.spec.js` | External host plus managed Lit child lifecycle composition is not replaced by these unit tests; needs an integration guide and integration test. |
| `docs-list-composition` | `collection-view/collection-view-reconciliation.spec.js`, `collection-view/collection-view-data.spec.js`, `collection-view/collection-view-sorting.spec.js`; independent installed `collection-removal-survivors` fixture | Interactive list example's combined selection, draft retention and subscription accounting no longer executes. |
| `docs-prerendered-content` | `view-fixed-root.spec.js`, `view.renderer.spec.js`, `region-adoption.spec.js`, `view-ownership.spec.js` | Existing HTML task guide still needs a complete consumer example/check. |
| `docs-radio-owner` | `radio.spec.js`, `radio-composition.spec.js`, `mixins/radio.spec.js`; current Radio reference examples | Removed notifications-owner sample; current package reference has independently checked request/event/cleanup examples. |
| `docs-region-lifecycle` | `region-lifecycle.spec.js`, `region-detach-contents.spec.js`, `region-placeholder` behavior in `view-region-placeholder.spec.js`, `region-adoption.spec.js` | Retryable delete composition is retired; core Region lifecycle and placeholder behavior remain independently tested. |
| `docs-routing` | `application-preparation.spec.js`, `application-child-lifecycle.spec.js`, `application-start-region.spec.js` | Latest-request helper, route selection, retained refresh, stale failures, native Navigation API and Backbone URL integration need new task guides and tests. Core Application tests do not replace routing tests. |
| `docs-utils-contract` | `utils/extend.spec.js`; `test/dist/validate.mjs` checks version/export consistency; current Common reference extension example | Removed utility/version doc fences; utilities reference remains unfinished. |
| `docs-view-child-region` | `view-get-region.spec.js`, `view-region-registration.spec.js`, `view.child-views.spec.js`, `region-detach-contents.spec.js` | Removed repeated parent/child Region example; current View/Region reference examples validate their own composition. |
| `docs-view-dom-interactions` | `view-dom-delegation.spec.js`, `view.ui-event-and-triggers.spec.js`, `behavior-dom-delegation-contract.spec.js`; retained native browser boundary tests | Old form, custom delegation, and nested-ownership teaching samples retired. Browser semantics are checked independently of doc prose. |
| `docs-view-render-attributes` | `view-render-attributes.spec.js`, `runtime/dom-api.spec.js` | Removed selected-row teaching example; native attribute behavior remains independently tested. |

## Retained installed documentation fixtures

- `docs-package` retains content hashes, package-contained link resolution,
  consumer/maintainer separation, and equality of the two packaged skill copies.
  It executes the current agent guide's list/search/page commands from the
  canonical, distribution, and copied skill directories; checks section bytes,
  diagnostics, and explicit external package roots. Obsolete MCP requirements,
  old `getUI` headings, bundled test evidence, and old skill command expectations
  are removed. A stale symbol-index assertion is retired: current navigation uses
  sections; symbol lookup still requires a packaged matching symbol index.
- `docs-quick-start` extracts the installed guide's actual HTML and entry module,
  executes the Lit example, verifies mounted content, replacement/destruction and
  Region emptying, and confirms the optional data package is absent. Its lockfile
  now includes Lit and the fixture runner supplies the candidate adapter. It does
  not test browser layout, Vite, or the shell installation recipe; those are
  separate consumer/build checks.

The release fixture inventory and runner select the current set. The independent
runtime, adapter, package, type and lint fixtures remain registered.

## Browser examples

The dedicated `docs-routing.test.mjs`, npm script and CI step are retired because
they extract removed routing/latest-request modules. They previously covered
native and Backbone route history, cancellation, out-of-scope navigation and
teardown; no equivalent replacement is claimed.

The coordinated browser migration preserves native interaction-boundary,
Morphdom iframe-retention and form-delegation checks as independent tests.
Removed custom Application effect, refresh and pagination cases remain documented
coverage gaps. The release browser inventory names the retained tests.

## Validation

The two installed fixture reports below were refreshed after the final review edits, using new tarballs from the final staged package. Other checks retain their scope noted below.

Executed after refreshing the staged package:

- `npm run docs:package` passed; five fresh local tarballs were packed.
- Both `npm run test:fixtures -- --fixture docs-package ...` and
  `--fixture docs-quick-start ...` passed with all five explicit tarball arguments.
  Reports: [package discovery](docs-package-migration.json) and
  [quick start](docs-quick-start-migration.json). The package fixture checked 314
  relative links and the portable helper. The quick-start fixture confirmed that
  the optional data package was absent.
- `npm exec -- node --test test/tooling/fixtures.test.mjs` passed all 12 harness tests. An initial direct Node invocation failed its required npm environment precondition; the corrected npm invocation passed.
- ESLint passed for both changed fixture validators and `test/fixtures/run.mjs`.
- All 27 remaining fixture directories match the release inventory.
- The final quick-start entry module, without a redundant renderer setter,
  successfully built with Vite in a separate consumer.

Full runtime or browser results are separate evidence; this mapping is based on
source inspection and does not claim that every linked suite ran during the audit.

## Product integration gaps versus retired teaching samples

External-host/managed-Lit composition and combined list subscription accounting
are integration coverage gaps worth checking independently of new guides. They
need no public sample or teaching decision before a focused installed-package
test can be added. Existing unit and survivor checks establish related guarantees,
not these complete combinations. Routing history integration also needs separate
consumer evidence when claiming support for that combination; Marionette itself
does not supply a router.

Save policies, dirty baselines, latest-request helpers, pagination, and widget
workspace examples were application implementations. Their removal does not
remove a core API, but no current guide inherits their acceptance results.
