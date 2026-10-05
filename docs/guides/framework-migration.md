# Migrate from another UI framework

Preserve the application's observable behavior while designing a native Marionette
ownership tree. Translating each Vue component, React hook, or store into a similar
Marionette file can preserve the old architecture's problems. Decide who owns data,
UI, readiness, and mutations before choosing the order of implementation.

This guide targets **5.0.0-rc.2**, source
[`f4243b8334cafe0bd1b06eba85d87e2310cb3618`](https://github.com/marionettejs/marionette/tree/f4243b8334cafe0bd1b06eba85d87e2310cb3618).
Use [matching packages](../quick-start.md#install-the-release-candidate) and their
installed contracts. For an existing Marionette v4 app, use the separate
[v4 migration guide](migration.md).

## 1. Inventory behavior before implementation

Build a journey matrix from the running original app and its public contracts.
For each journey, record the entry URL, role/permissions, inputs, visible outcomes,
API methods/payloads, failure cases, and evidence. Include direct links, navigation,
search/filter/sort, edits, uploads, empty states, keyboard/focus, persistence after
reload, and work interrupted by navigation. Identify cross-feature behavior such
as a rename appearing in both a list and an open detail panel.

Keep known baseline bugs explicit: record the reproduction and decide whether to
preserve it temporarily or fix it intentionally with a changed expectation. A
failing original journey is evidence, not permission to omit the feature. Separate
observed behavior from intended behavior where they differ.

Run the original through its **public UI against a controlled backend** before
building the replacement. Reuse those same journey tests against the replacement
by changing its base URL and startup configuration. Prefer accessible roles,
labels, URLs, visible state, and recorded API contracts. Avoid Vue component
instances, React internals, store getters, private Marionette fields, or selectors
that encode the old component tree. A small public test-id contract can identify
controls without making their component layout part of the specification.

Control test accounts, permissions, fixture reset, request delays, rejection,
and out-of-order completion. Check that a successful edit survives reload and
that forbidden edits fail at the backend as well as being unavailable in the UI.
Keep backend contract tests alongside browser journeys; local mocks cannot prove
server permissions or real payload compatibility. Review test changes separately:
do not weaken assertions or add skips to make the replacement pass. Deliberately
break a representative response or interaction and confirm the test fails.

## 2. Draw the final ownership tree independently

Use [architecture](../architecture.md) to define the target tree from domain
lifetimes and user journeys. The old source is evidence for business rules and
edge cases; its folders and component boundaries do not decide the final tree.

For a record workspace, a possible target is:

```text
WorkspaceApplication — navigation, session, shared service access
└─ ShellView — persistent navigation and destination Region
   └─ RecordApplication — record readiness, draft and workflow decisions
      └─ RecordPageView — editor and summary Regions
         ├─ TitleEditorView — input interaction, borrowed draft
         └─ SummaryView — presentation of the latest loaded title
RecordService — transport, serialization and persistence contracts
```

An Application coordinates a feature lifetime; a View owns presentation and local
interaction; a Region places and disposes its child. Use CollectionView for repeated
records that need independent children. A View can call its model/API layer to save
a local edit; an async call alone does not justify an Application. Put shared
workflow decisions and work that survives panel replacement with a surviving owner.

For every source or operation, record:

| Decision | Example |
| --- | --- |
| Owner and borrowers | RecordApplication owns its draft; editor borrows it. A shared record cache belongs to the session/service lifetime. |
| Mutation authority | Editor updates draft title; feature coordinates publishing; service persists. Siblings emit intent instead of editing each other's DOM. |
| Readiness | `prepareStart(options, { signal })` loads required data; `onStart` applies only the current result. |
| Retention | Restart preserves shell/input; Region replacement destroys its outgoing View; stop destroys root UI but retains Application state. |
| Cancellation and release | Pass preparation signal to transport. Give ongoing saves their own cancellation/concurrency policy and end external effects at their owner. |

`start()` and `restart()` resolve `true` on success, `false` when superseded, and
reject for a current preparation failure. `stop()` and `destroy()` are synchronous;
notification hooks do not await Promises. The preparation signal ends with that
operation, so it is not an ongoing feature-lifetime signal. Avoid application side
effects during preparation that could commit after cancellation. See
[Application](../api/application.md), [retained restart](retained-restart.md), and
[routing](routing.md) for complete lifecycle/error boundaries.

A supplied state source is borrowed; `createState()` establishes owned state.
Declare what survives panel replacement, route exit, stop, and reload separately.
Choose one writer or an explicit conflict policy for each shared mutation. Model
observation and server persistence are separate capabilities: optional `@mnjs/data`
has no `Model.save()` or `fetch()` contract. Do not assume Backbone methods.

## 3. Choose the migration strategy deliberately

A replacement branch can have incomplete routes while the correct architecture is
being built. Full parity is the final goal; keeping a hybrid app functional at
every intermediate checkpoint is not a default requirement. Preserve the runnable
original as the baseline and record unavailable replacement journeys honestly.

Choose **leaf-first** when a leaf has a clean DOM/data boundary and its replacement
will be reused unchanged in the target tree. A date picker or independent panel
may qualify. Do not start there merely because leaves are small: dependencies on
old stores, parent effects, or component conventions can turn every leaf into a
compatibility project.

Choose a **native feature-family replacement** when the old tree obscures ownership
or when no production coexistence is required. Establish the shell, service boundary,
and one representative journey, then migrate related behavior in broad batches:
record list/filter/detail; editing/validation/persistence; permission-sensitive
commands; navigation/recovery. Each batch includes its data, UI, effects and tests,
rather than converting files individually. This avoids repeatedly inventing the
same authority and cleanup rules across dozens of components.

Pilot a representative risk early: an editable record with a shared list/detail,
a permission boundary, delayed readiness, navigation away, and retry. Use it to
challenge the ownership plan before scaling. A trivial static page is useful for
installation, but does not validate migration architecture.

If production must run both frameworks, use [existing UI](existing-ui.md) for an
explicit host boundary: one owner per DOM subtree, public inputs/events, cleanup
before removing the mount, and no sibling DOM access. Record the bridge owner,
why coexistence is required, the consuming routes, and the concrete condition for
deleting the bridge and its dependencies. Keep the bridge at that boundary rather
than teaching every new View the old framework's store or lifecycle.

## 4. Work through a native ownership example

This invented Vue-like sketch combines readiness, UI and draft authority in a
component. It is illustrative pseudocode, not an executable Vue recipe:

```text
RecordPage.vue
  setup(): obtain route id and global store
  watch(route.id): fetch record, overwrite store, reset form
  component state: title draft and request/loading flags
  template: title editor + summary + reload button
  child callbacks: write global store and query parent's DOM
  unmount(): cancel component request
```

The native replacement below separates readiness from local interaction. It uses
Lit for safe text interpolation and stable input updates, and observable state
from `@mnjs/data`. Follow [setup](../integrations/setup.md) for matching companion
packages. `GET /records/42.json` returns `{ "title": string }`; API access stays in
`loadRecord`, which can move into the application's service module.

```js
import { Application, View } from 'marionette';
import { Model, DataApi, StateApi } from '@mnjs/data';
import LitDomApi from '@mnjs/adapters/dom/lit-html';
import { html } from 'lit-html';
import { live } from 'lit-html/directives/live.js';

async function loadRecord(id, signal) {
  const response = await fetch(`/records/${encodeURIComponent(id)}.json`, { signal });
  if (!response.ok) throw new Error('Could not load record.');
  return response.json();
}
const PageView = View.extend({
  template: () => html`
    <button type="button" class="reload">Reload</button>
    <section class="editor"></section><section class="summary"></section>`,
  regions: { editor: '.editor', summary: '.summary' },
  triggers: { 'click .reload': 'reload' },
}).setDomApi(LitDomApi);
const TitleEditorView = View.extend({
  template: ({ title }) => html`
    <label>Title <input class="title" .value=${live(title)}></label>`,
  ui: { title: '.title' },
  events: { 'input @ui.title': 'editTitle' },
  modelEvents: { 'change:title': 'render' },
  editTitle() { this.model.set('title', this.getUI('title')[0].value); },
}).setDataApi(DataApi).setDomApi(LitDomApi);
const SummaryView = View.extend({
  template: ({ loadedTitle, error }) => html`
    <p>Loaded title: ${loadedTitle}</p><p role="status">${error}</p>`,
  modelEvents: { 'change:loadedTitle': 'render', 'change:error': 'render' },
}).setDataApi(DataApi).setDomApi(LitDomApi);

const RecordApplication = Application.extend({
  createState() { return new Model({ title: '', loadedTitle: '', error: '' }); },
  viewEvents: { reload: 'reloadRecord' },
  prepareStart({ id }, { signal }) { return loadRecord(id, signal); },
  onStart(_app, { id }, record) {
    this.recordId = id;
    const state = this.getState();
    state.set({ loadedTitle: record.title, error: '' });
    if (this.getView()) return;
    state.set('title', record.title);
    const page = this.setView(new PageView());
    page.showChildView('editor', new TitleEditorView({ model: state }));
    page.showChildView('summary', new SummaryView({ model: state }));
    this.showView();
  },
  reloadRecord() {
    return this.restart({ id: this.recordId }).catch(error => {
      this.getState().set('error', error.message);
    });
  },
}).setStateApi(StateApi);

const mount = document.createElement('main');
document.body.append(mount);
const app = new RecordApplication({ region: { el: mount } });
await app.start({ id: '42' });
```

Reload repeats readiness for the **same record**. Only SummaryView updates; the
page and editor stay owned by their Regions, and unfinished input survives. The
editor's `ui` map gives its owned control one name instead of repeated
`querySelector` calls. Read `getUI('title')[0]` after binding; bindings rebind on
render and are snapshots, so do not keep a stale element across replacement.

A route to another record needs a deliberate draft policy: retain drafts by id,
ask before discarding, or stop/start to reconstruct. Do not use this same-record
reload as an implicit navigation policy. For initial readiness failure, the caller
handles rejection and stops the failed run before error presentation; the
[routing example](routing.md#route-to-asynchronous-features) supplies that boundary.
This example has no save operation: adding one requires the service's write
contract and a decision about cancellation, duplicate submissions, conflict, and
which surviving owner receives completion. See [local editing](local-editing.md).

## 5. Use separate architecture and behavior gates

At each feature-family checkpoint, review **source** for the intended ownership,
mutation authority, cancellation, stable UI bindings, and removed compatibility
paths. Then run the reusable **behavior tests** against the integrated replacement.
Passing interactions can hide a replacement that still delegates to the old app;
a clean source tree can still break a journey. Neither gate replaces the other.

Keep one short checkpoint record in the application's existing project notes:

```text
Batch: record editing
Decisions: feature owns draft; service persists; same-record reload retains editor
Evidence: exact revision/packages, commands, environment, journey results
Open failures: permission revocation during save; unimplemented bulk edit route
Coverage boundary: real backend tested for save; conflict path still mocked
Next: resolve conflict policy, complete bulk edit, rerun list/detail/save together
```

Exercise true integration across feature families: direct URL → readiness → edit
→ save → list/detail update → navigation → reload; also auth expiry and permission
changes, rapid route changes, slow responses, stop/start, and repeated attachment
where widgets/listeners depend on it. Use a real browser for focus, keyboard,
history and editable-state behavior. Component tests and screenshots support this
coverage but do not establish it. Report baseline failures separately from new
regressions and explicitly unimplemented routes. Test counts and converted file
counts are progress measures, never completion claims.

## 6. Audit the final replacement

Re-run the full journey matrix against the production entrypoint and controlled
backend, with all intentional behavior changes documented. Audit source imports,
dynamic imports, route lazy chunks, build plugins, manifests/lockfile, and the
actual generated bundle/module graph. Remove the old framework, adapters, stores,
bridges, obsolete entrypoints, unused styles, and dependencies when no required
consumer remains. A green suite does not prove removal; verify the new app cannot
reach or invoke the old implementation, including through lazy routes.

Preserve applicable public licenses and attribution for reused source/assets.
Use public examples or authorized project code; do not copy private application
source into public documentation or fixtures. The public
[Marionette RealWorld example at a pinned revision](https://github.com/marionettejs/marionette-realworld-example-app/tree/34ceaa5987c1e80dfa6b6f2285cb9fcb5296ce04)
is a reference to inspect, not proof of parity for another application.

## Agent checklist

- Pin original/replacement revisions, package contract, backend fixtures and known bugs.
- Run portable journey tests on the original; check their ability to catch breakage.
- Define target owners, borrowers, writers and cancellation before converting code.
- Choose leaf-first or native feature batches with a reason; document bridge deletion only if needed.
- Pilot representative risk, then complete related behavior in broad batches.
- Review architecture and test changes separately from integrated behavior results.
- Record decisions, exact evidence, incomplete routes and open failures at checkpoints.
- Finish parity and prove old-framework removal in imports, dependencies and bundles.

## Further reading

[Playwright best practices](https://playwright.dev/docs/best-practices) covers
user-facing locators, isolated test state, controlled data, and retrying assertions
for the reusable browser journeys.

[Addy Osmani's Brownfield Agentic Engineering](https://addyosmani.com/blog/brownfield-agentic-engineering/)
explains characterization, durable context, and completing migration units with
old dependencies removed.
[Anthropic's migration guide](https://claude.com/blog/ai-code-migration)
describes a portable behavior judge, checking that it detects broken behavior,
and distinguishing translation from architectural redesign. Apply those verification
principles to UI journeys while using Marionette's installed contracts for the
replacement architecture.
