# Documentation map and coverage

Historical audit baseline: 2026-09-29, working tree based on `b6f23c5953793d5cef1cb51dbc675420214ffd01`, package version `5.0.0-rc.2`. At that time the runtime diff SHA-256 was `c356d888e6a87a840f754348b44cf32e684b0684026e4f9f29a640641755cdf6`. Those changes are now committed as `e306ca7b`; see the [committed baseline](baseline-status.md). This remains the working inventory for the [plan](plan.md), with original audit evidence tied to its recorded revision/hashes.

## How to use this inventory

**Partial** means useful current material exists but the row's scope is incomplete. **Missing** means no dedicated treatment in the rebuilt consumer docs. **Complete** requires an audited public member list, verified contracts, and answered representative author lookup questions. Independent reader usability is tracked separately and remains unverified until tested. **Unverified** describes evidence, not a passing result. Deferrals retain their gap, reason, and revisit condition here.

This baseline maps API families and reader needs, not every member. Do not turn its row counts into a coverage percentage. For the class being authored, expand its row into a member checklist covering options, inherited methods, properties, extension points, hooks, and events. Mark each member documented or explicitly outside the supported public contract, with a reason. Reconcile declarations with implementation and tests; export or visibility alone does not establish recommended usage. Extend this file as needed instead of building a separate inventory tool now.

Coverage below describes the rebuilt consumer documentation, including the new class/shared reference pages. Existing companion READMEs, declaration examples, and consumer lint are additional surfaces that require consistency review; their presence does not certify rebuilt coverage. Source links identify where to inspect the contract. They are not claims that every linked behavior has been tested in this milestone.

## Public API audit rule

1. Start with current package export maps, source entrypoints and their consumer declarations. Include exported runtime APIs and non-internal constructor/static/instance members, configuration options, hooks and events reachable through supported classes, including inherited members. Default these to requiring documentation.
2. Classify an explicitly internal member or implementation detail as internal, with its declaration/source evidence. An underscore is a signal to inspect, not grounds to silently exclude a supported extension point. Exported type helpers need appropriate type-reference treatment, not automatically a tutorial.
3. Use implementation and focused tests to verify behavior. Test coverage alone does not make an API public; v4 precedent does not establish a v5 contract. If runtime and declarations disagree, or support is ambiguous, record **needs decision** and the conflict. Keep it visible as a gap; do not omit it to claim completion or silently change the framework.
4. For each member, record **documented** (canonical link), **missing/partial** (gap), **internal** (reason/source), or **needs decision**. Mark deprecated only when verified current v5 evidence says so, and document its supported contract. A supported export cannot be discarded as unimportant to the example.

For a completed class, every candidate member must have a disposition and no unresolved supported-member gap. Audit lifecycle events from implementation as well as declarations; event names may not all appear in the type surface.

## Public API families

The [core export surface](../../src/index.ts) and companion export maps establish the starting boundary. Every core runtime export is assigned below, including shared re-exports. Audit public type exports alongside their owning API; application authors also need accurate TypeScript examples.

| Area | Current coverage | Scope still to cover | Source anchor |
| --- | --- | --- | --- |
| Application | Audited supported class surface: [Application](../../docs/api/application.md), [member audit](evidence/application-reference-audit.md) | Independent-reader effectiveness remains unverified. Exact lifecycle reentry/destination binding and prepared-root reselection behavior remain partial in the semantic inventory; Radio and providers have their own rows. | [Application](../../src/modules/application.ts) |
| View | Audited supported class surface: [View](../../docs/api/view.md), [member audit](evidence/view-reference-audit.md) | Independent-reader effectiveness remains unverified. Provider authoring is documented in its separate rows. | [View](../../src/modules/view.ts), [shared View behavior](../../src/mixins/view.ts) |
| CollectionView | Audited supported class surface: [CollectionView](../../docs/api/collection-view.md), [member audit](evidence/collection-view-reference-audit.md) | Independent-reader effectiveness remains unverified. The RegionClass constructor-type mismatch remains an explicit limitation. | [CollectionView](../../src/modules/collection-view.ts), [children](../../src/modules/child-view-container.ts) |
| Region | Audited current surface: [Region](../../docs/api/region.md), [member audit](evidence/region-reference-audit.md) | Missing-selector recovery is a known runtime limitation with a design decision outstanding; current behavior is documented. Independent-reader effectiveness remains unverified. | [Region](../../src/modules/region.ts), [fluent methods](../../src/modules/common/chainable-methods.ts) |
| Behavior | Audited supported class surface: [Behavior](../../docs/api/behavior.md), [member audit](evidence/behavior-object-reference-audit.md) | Independent-reader effectiveness and widget integration guide remain unverified/missing. | [Behavior](../../src/modules/behavior.ts), [composition](../../src/mixins/behaviors.ts) |
| MnObject | Audited supported class surface: [MnObject](../../docs/api/mnobject.md), [member audit](evidence/behavior-object-reference-audit.md) | Independent-reader effectiveness remains unverified; full channel API is a separate row. | [MnObject](../../src/modules/object.ts) |
| Shared class utilities and `extend` | Documented inherited surface: [common methods](../../docs/api/shared/common.md), [audit](evidence/shared-reference-audit.md) | Standalone utility exports remain a separate audit. | [Common](../../src/mixins/common.ts), [extend](../../packages/utils/src/extend.ts) |
| Events and child forwarding | Documented: [Events](../../docs/api/shared/events.md), [child forwarding](../../docs/api/shared/view-bindings.md#child-events), [audit](evidence/shared-reference-audit.md) | Independent lookup and transfer evidence still pending. | [Events](../../packages/utils/src/events.ts), [View forwarding](../../src/mixins/view.ts) |
| State | Owner contract documented: [State](../../docs/api/shared/state.md), [audit](evidence/shared-reference-audit.md) | Provider-authoring interfaces are documented below; dedicated alternative integration guides remain separate work. | [State mixin](../../src/mixins/state.ts), [StateApi](../../src/runtime/state-api.ts) |
| Runtime and configuration | Audited: [runtime configuration](../../docs/api/runtime.md), [audit](evidence/runtime-dom-reference-audit.md) | Independent-reader setup/isolation effectiveness remains unverified. | [Runtime factory](../../src/create-marionette.ts) |
| Renderer and DOM providers | Audited: [Renderer, DomApi, EventDelegator](../../docs/api/providers/dom.md), [audit](evidence/runtime-dom-reference-audit.md) | Dedicated optional integration guides remain separate; provider types do not establish every consumer/output combination. | [Renderer](../../src/runtime/renderer.ts), [DomApi](../../src/runtime/dom-api.ts), [delegation](../../src/runtime/event-delegator.ts) |
| Data providers | Audited: [DataApi/StateApi](../../docs/api/providers/data.md), [audit](evidence/data-provider-reference-audit.md) | Core collection callback remains typed unknown and has limited malformed-payload diagnostics. A synchronous initial observer notification causes an internal TypeError; see the decision item below. Full native data package and optional adapter APIs remain separate rows. | [DataApi](../../src/runtime/data-api.ts), [native providers](../../packages/data/src/api.ts) |
| Radio and requests | Audited: [package reference](../../docs/packages/radio.md), [declarative owner bindings](../../docs/api/shared/common.md#declarative-radio-bindings), [member audit](evidence/radio-reference-audit.md) | Independent-reader lookup and transfer remain unverified. | [Package exports](../../packages/radio/src/index.ts), [owner integration](../../src/mixins/radio.ts) |
| Errors and diagnostics | Audited: [error reference](../../docs/api/errors.md), [source audit](evidence/utils-errors-reference-audit.md) | Independent debugging effectiveness and expanded troubleshooting recipes remain unverified. | [Error](../../packages/utils/src/error.ts), [core exports](../../src/index.ts) |
| `@mnjs/data` | Audited: [Model and Collection](../../docs/packages/data.md), [member audit](evidence/data-package-reference-audit.md) | Independent reader effectiveness remains unverified. The reference records incomplete transport/persistence, open event metadata types, and the `toArray` generic limitation. | [Exports](../../packages/data/src/index.ts), [Model](../../packages/data/src/model.ts), [Collection](../../packages/data/src/collection.ts) |
| `@mnjs/utils` | Audited: [package reference](../../docs/packages/utils.md), [source audit](evidence/utils-errors-reference-audit.md) | Independent-reader lookup remains unverified; shared Events and class methods stay canonical at their linked references. | [Exports](../../packages/utils/src/index.ts) |
| `@mnjs/adapters` | Audited: [optional adapters](../../docs/packages/adapters.md), [audit](evidence/adapters-reference-audit.md) | Five exported entrypoints have executable examples and configuration/ownership guidance. Independent integration choice and transfer remain unverified. | [Export map](../../packages/adapters/package.json) |
| Consumer lint and package entrypoints | [Installed entrypoint](../../docs/readme.md#find-these-docs-from-an-installed-package), [agent workflow](../../docs/agents.md), [tooling recipes](../../docs/tooling.md) and [recipe audit](evidence/consumer-tooling-audit.md) | Rule limitations are documented; lint completeness and independent debugging outcomes remain unproven. | [Core export map](../../package.json), [lint entrypoint](../../tools/eslint/index.mjs) |

## Reader needs beyond API lookup

| Need | Current material/status | Remaining work and useful check |
| --- | --- | --- |
| Install and render first UI | Partial: [quick start](../../docs/quick-start.md), tested as a local candidate | Registry/release path and supported environment still need release integration. Recheck documented commands from a clean installed package. |
| Understand Marionette's model | [Ownership and lifetimes](../../docs/architecture.md): standalone responsibilities, readiness/refresh, state, composition and cleanup. | Independent reader effectiveness remains unverified. Check whether a reader chooses a View for local interaction and an Application for an independently managed feature. |
| Adopt existing HTML or compose nested UI | [Existing HTML](../../docs/guides/existing-html.md) explains adoption without rendering, lifecycle and destruction. | Installed execution and browser interaction verified; independent reader transfer remains unverified. |
| Embed UI under another owner | [Existing UI](../../docs/guides/existing-ui.md) covers host-owned mounts, Region-owned content and asynchronous cleanup constraints. | Generic boundary tested; a real host-framework integration and independent reader transfer remain unverified. |
| Edit local state | [Local editing](../../docs/guides/local-editing.md) uses a View and borrowed Model. | Focus and cleanup checked in browsers; persistence and independent reader transfer remain separate. |
| Work with lists | Reference and standalone snippet: [CollectionView](../../docs/api/collection-view.md); records remains one composed lesson. | Independent task-guide and reader evidence remain partial; reference now covers filtering, sorting, empty presentation and identity. |
| Manage async readiness and failures | [Application reference](../../docs/api/application.md) plus records lesson. | Independent architecture/reader evidence across different owner lifetimes remains unverified. |
| Refresh retained UI and navigate | [Retained refresh](../../docs/guides/retained-refresh.md) covers Application-owned requests and stable page/input identity. | [Navigation](../../docs/guides/routing.md) adds synchronous destinations, retained shell, fragment history and subscription cleanup. Async transition policies, path-router integration and independent reader transfer remain unverified. |
| Reuse behavior or integrate a widget | Partial: [Behavior](../../docs/api/behavior.md) and [MnObject](../../docs/api/mnobject.md) references explain boundaries and cleanup. | Dedicated widget integration task guide and independent choice/transfer evidence remain missing. |
| Choose or replace data/rendering integrations | [Runtime](../../docs/api/runtime.md), [DOM](../../docs/api/providers/dom.md) and [data/state](../../docs/api/providers/data.md) references plus one setup recipe. | Independent configuration/transfer evidence and dedicated optional integration guides remain missing. |
| Use TypeScript | [Practical guide](../../docs/guides/typescript.md): typed initialization, state, DOM narrowing, readiness results and optional data; [tooling](../../docs/tooling.md) supplies the compiler setup. | Four actual guide fences compile and execute against installed exports, with strict browser compilation and six rejected invalid edits. Event-name payload correlation and provider-source correlation remain runtime responsibilities. Independent reader transfer is unverified. |
| Test and debug | [Consumer testing](../../docs/guides/testing.md) provides five runnable interaction, replacement, readiness and teardown tests; [tooling](../../docs/tooling.md) covers lint, types and diagnostics. | Installed recipe and cleanup sensitivity verified. Real application/browser test coverage and independent debugging outcomes remain separate. |
| Accessibility and safe rendering | Partial: ordinary Lit interpolation | Framework-relevant guidance on semantic UI, focus across replacement, and renderer trust boundaries; verify claimed behavior. |
| Migrate and deploy | [v4 migration](../../docs/guides/migration.md) covers the common upgrade sequence and verified breaking changes. | Actual consumer migration/reader outcomes and specialized overrides remain unverified. Production/deployment guide and release acceptance remain incomplete. |

## Historical planning baseline

Before this slice, class references had not been audited. The [earlier package report](evidence/package-discovery.json) and [destruction cleanup checks](evidence/destroy-cleanup-verification.json) retain that snapshot's evidence; subsequent evidence is in [View and Region results](view-region-results.md) and [CollectionView results](collection-view-results.md). The last full unit run had 10 missing-file failures in the retired-docs example suite. Production publishing and retired-docs tests still require migration.

## View and Region reference slice

**Reader need:** understand and manage a piece of UI without first learning the records application. These two classes underpin composition; this slice addresses their initial reference omissions.

**Delivered:** a direct API index and audited supported View/Region references, with the Region recovery limitation recorded. Apply the member audit rule above to both classes, including static and inherited members.

**Shared-contract boundary:** author canonical contracts for their inherited event/common methods and shared View UI/DOM/entity/child bindings, rendering and state ownership. Link these from the class pages so CollectionView can reuse them. The class references must explain the accepted options and behavior of their renderer/data/state configuration and `behaviors` option. Full provider-authoring interfaces, standalone utility exports and the Behavior class reference remain separate inventory gaps. Link the existing setup recipe only for the integration it actually explains; label remaining coverage partial without creating empty reference pages.

Move authoritative contracts out of the compact reference as replacement pages land. Update every inbound link in consumer docs, README/llms entrypoints, examples and planning; do not preserve obsolete sections as redirect stubs. Keep other families visibly partial until covered.

**Representative author lookup checks:**

1. From the index, find how to adopt an existing element and what render and destruction do to it.
2. Find how to detach a Region's child while retaining it, and how that differs from emptying the Region.
3. Find how to add/remove/query a View's Regions and whether each operation renders or destroys UI.
4. Find the argument and ordering contracts for View/Region lifecycle events.
5. Find how UI bindings and child intent forwarding work, including which owner releases listeners.
6. Find the Region event order when replacing a CollectionView, including which events belong to the Region and which to the outgoing child.

The [slice results](view-region-results.md) record paths, answers and evidence for these checks. They are author lookup checks, not independent-reader results. Select unseen questions for later reader evaluation.

**Completion checks:** member audit including shared/inherited surface; one authoritative definition per moved contract; relevant behavior/example checks; compile TypeScript examples against the package declarations; recheck inbound links/anchors after moving sections. Run executable snippets or identify their precise source/test backing and label any unexecuted example. Report all six dimensions, with independent-reader usability unverified for this authoring slice; no fresh-agent trial is required to complete the reference work. Update the inventory and select the next slice by remaining need. The [peer decisions](peer-comparison.md#framework-wide-decisions) explain the chosen structure and what would prompt revision.

**Scope boundary:** no additional records features, retrieval server, framework runtime changes, publication, or model campaign is needed for this slice. Record any discovered dependency and its concrete impact before expanding the work.

## Planning setup review

The [Claude review](evidence/scope-review.json) received the full plan, inventory, peer decisions, and planning index. It supported the framework-wide direction and identified a missing public-API classification rule, loose shared-contract scope, ambiguous stage numbering, and missing link/type checks. Those were addressed above and in the plan/index. Its suggestion to include `setElement` was not adopted: the inspected v5 View declaration uses a fixed element and does not expose that method. The review assessed the supplied planning artifacts before these corrections; it did not validate API completeness or teaching effectiveness.

Setup validation checked that all 21 core runtime exports are assigned to an inventory area and that local links and heading anchors resolve. This checks the map's structure, not member coverage. No framework, example, or consumer-doc content changed in this setup step.

## Current result and next priority

The [runtime/provider results](runtime-provider-results.md) add configuration scope, isolated families and full Renderer/DomApi/EventDelegator/DataApi/StateApi member contracts, following the [six core class references](behavior-object-results.md). The native data integration's observable/persistence boundary remains explicit. Provider registration types do not prove a correct integration, and the public collection callback is still typed unknown.

The [concepts and retry preparation](concepts-results.md) replaces the records-specific architecture explanation with a standalone guide. The documentation index and quick start route to it before the optional lesson. This closes the authoring gap; teaching effectiveness remains unverified.

**Completed authoring/local delivery:** [migration and consumer testing](migration-testing-results.md), followed by [practical TypeScript](typescript-results.md). Current evidence covers 32 packaged pages, 41 independently executed fences, 15 TypeScript examples, 20 declaration fixtures, and the four-file/five-test consumer recipe. The TypeScript guide also compiles under the documented strict browser configuration and rejects six invalid edits. The semantic inventory records 49 documented groups and seven partial groups; these are dispositions, not completeness percentages. [Existing UI and navigation](integration-routing-results.md) follow this slice. Next reader priorities are production behavior and accessibility/rendering trust boundaries. An actual consumer migration and independent teaching effectiveness remain unverified. Full release acceptance remains separate.

## Runtime decision requiring follow-up

The data provider audit reproduced an internal TypeError when a provider synchronously emits reset/reorder/update during initial observer registration. Current docs require subscription to subsequent changes. Decide whether to reject initial replay with an actionable diagnostic or support it after container setup; then add a focused regression test and update the provider contract atomically. This is a runtime robustness gap, not resolved by this documentation slice. [Reproduction and source evidence](evidence/data-provider-reference-audit.md#initial-notification-requirement).

The standalone `monitorViewEvents(view)` export is documented in [View lifecycle monitoring](../../docs/api/view.md#lifecycle-hooks-and-events), including its argument, return value, idempotent installation and required structural View behavior. It is distinct from the View class option. The runtime page links that canonical contract.
