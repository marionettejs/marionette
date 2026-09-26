# Application teaching audit

Reviewed the consumer teaching path against Marionette source
`376b9ce23b3926dd5033c35d0a1a6a751aee1bef`, then changed documentation,
starter code, and their validation. Production library source is unchanged.

## Evidence and comparison

The app-frontend checkout at `281504635e65c97ce03a3772795fede5d772e7cf`
provided concrete comparison points: `programs-all_app.js`, its companion Views,
and `schedule-results_app.js`. Applications own readiness, service calls, and
feature policy. Views own selectors, templates, and presentation. Semantic child
events and `listenTo` connect them. Active refresh belongs to the results
Application; a request helper does not replace that owner. Host removal also
invalidates effects. No product code or domain data was copied into the examples.

The RealWorld working tree supplied a contrasting case: its feed factory creates
request controllers and observable sources, its View's `onRender` starts loading,
and a closure coordinates results and pagination. View destruction aborts work,
but that fact alone does not justify View ownership of the feed workflow. This is
working-tree evidence, not an immutable application acceptance result.

The audit searched consumer guides, the starter, skill routes, and their executable
fixtures for factory facades, manual disposal, asynchronous loading, DOM ownership,
and state observation. Findings are teaching defects even when the small example's
interaction tests pass. This is not a fresh-agent usability study.

## Disposition

| Surface | Correction or retained boundary |
| --- | --- |
| Primary learning path | A complete named RootApplication/FeedApplication/View/CollectionView example demonstrates startup, pagination, retry, observable status, child intent, and parent teardown. Agent, skill, class, and compact-reference entry points link to it. |
| Development starter | Application preparation loads records; an owned child Application loads details. Views emit intent and own DOM. Both definitions use Application.extend and import their data client directly. Shared setup replaces runtime-per-factory configuration. Framework lifecycle releases the collection and pending work. |
| Persistent shell and refresh | Named Applications own sources and request controllers. Removed factory facades and separate collection disposal. An active refresh is explicitly different from initial readiness. |
| Routing and selection | Applications expose their own operations. Router adapters remain external integration boundaries. Latest-request navigation explicitly retains the previous page; startup/loading-screen guidance points to readiness. |
| Delete and editor recipes | Delete loading uses Application readiness; presentation lives in its View. The editor workspace is a Region-owned View with child events and lifecycle-owned widget handles. |
| Lists | The screen owns its created Collection and its list Region; external observation updates surviving rows. Region destruction is sufficient cleanup. |
| Effects and Application reference | Export named Applications; use options for instance configuration or explicitly replaceable integrations. The primary feed example imports its ordinary data client directly. Keep external effect scopes and persistent-save policy separate from feature ownership. |
| Forms | Keep the single-control local draft/save case explicit. It does not prescribe View ownership of feeds, route activation, or multi-step workflows. Named UI holds descendant updates. |
| Resource cleanup | Replace the ordinary manually wired button with a real MutationObserver boundary; ordinary controls use framework delegation. |
| External hosting/widgets | Retain adapter handles where another library requires them. The Marionette owner releases them through its lifecycle. |
| Data/State/API references | Keep public source, observation, borrowed/owned, and synchronous failure contracts. No new recovery behavior or runtime API is introduced. |
| Verification guidance | Review owner choice and composition alongside interaction outcomes. Record a fresh-agent paginated-feed task as an evaluation requirement, not as completed evidence. |

## Verification and limits

Executable fixtures extract the documentation code. The feed checks readiness and
retry, event direction, direct state/model updates, retained identities, superseded
requests, parent stop/destruction, and host replacement. Browser checks exercise
focus and selection during pagination. Starter checks include packaged types,
lint, runtime behavior, parent ownership, external title updates, and Vite edits.

Retrieval checks include a paginated-feed question. Documentation checks cover
routes, exported fixture dependencies, markers, and links. Those checks establish
their specific contracts; they do not establish that a fresh agent will choose the
right architecture. Use the frozen evaluation procedure before making that claim.

### Commands run for this change

- `npm run test:fixtures -- --fixture data-package-starter` (includes a package
  build, isolated installation, TypeScript, lint, runtime tests, and Vite build).
- The same fixture command for `docs-quick-start`, `docs-list-composition`,
  `docs-region-lifecycle`, `docs-application-guides`, and `docs-routing`.
- `npm run test:browser -- test/browser/beta-starter.spec.mjs test/browser/application-refresh.spec.mjs test/browser/application-effects.spec.mjs test/browser/docs-form.spec.mjs`.
- `npm run test:browser -- test/browser/beta-starter.spec.mjs test/browser/application-refresh.spec.mjs test/browser/starter-development.spec.mjs --project=chromium`.
- `node --test test/browser/docs-routing.test.mjs`.
- `npm run test:agent-docs`, `npm run docs:check`, and `npm run check:api-contracts`.
- `npm run lint` found pre-existing ignored files under
  `test/fixtures/docs-routing/dist/` with lint errors. The authored tree is checked
  with `npm run lint -- --ignore-pattern 'test/fixtures/**/dist/**'`; those old
  generated files are preserved.

No agent pilot, package publication, or deployment was performed. Browser/fixture evidence
supports the tested examples, not a claim of improved fresh-agent outcomes.
