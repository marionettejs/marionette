# Refresh data without restarting a feature

Use Application `start` and `stop` for a feature's active lifetime. Use an explicit
refresh operation to load new data while keeping its layout, editor, and draft
alive. Restart deliberately ends the active session and destroys its Views.

The same latest-request controller can refresh a collection or navigate to a new
page. The difference is the commit: update an existing collection for refresh,
or show a replacement View for page navigation. Neither requires restarting an
Application.

## Share one latest-request controller

Save this module as `latest-request.js` and import it wherever the application
needs replacement requests. It is application code, not a Marionette export.
`load(input, { signal })` is asynchronous; `commit(value, input)` is synchronous.

<!-- executable-example: application-latest-request -->
```javascript
export function createLatestRequest({ load, commit }) {
  let pending;
  let disposed = false;

  function cancel() {
    pending?.abort();
    pending = undefined;
  }

  return {
    cancel,
    dispose() {
      disposed = true;
      cancel();
    },
    async run(input, { signal } = {}) {
      if (disposed || signal?.aborted) { return false; }
      cancel();
      const request = new AbortController();
      pending = request;
      const abort = () => request.abort();
      const releaseSignal = () => signal?.removeEventListener('abort', abort);
      signal?.addEventListener('abort', abort, { once: true });
      request.signal.addEventListener('abort', releaseSignal, { once: true });

      try {
        const value = await load(input, { signal: request.signal });
        if (request.signal.aborted) { return false; }
        commit(value, input);
        return true;
      } catch (error) {
        if (request.signal.aborted) { return false; }
        throw error;
      } finally {
        releaseSignal();
        request.signal.removeEventListener('abort', releaseSignal);
        if (pending === request) { pending = undefined; }
      }
    }
  };
}
```

`run` resolves `true` after committing and `false` for canceled work or a disposed
controller. A current load or commit failure rejects. Catch current failures at
the application boundary and provide a retry action. The post-await check also
protects against providers that ignore abort; a canceled Promise settles when
its loader settles. Cancellation does not force a non-cooperative loader to finish.

`cancel` aborts the pending request without clearing displayed data. `dispose`
also refuses future requests. External abort listeners are released on cancellation
even if the loader never settles. An already-aborted external signal leaves an
existing request alone. Old success, error, and cleanup continuations cannot
commit or discard a newer request's cancellation handle.
The external signal covers that pending request, not the feature's persistent effects.

## Keep a shell and independently owned children

Use this pattern when list results and a sidebar share a workspace but have different
UI state. The parent owns their active lifetimes and the shell. Each child owns its
own View; the list child owns its replaceable requests. A list refresh is not a
child `restart()` or a parent lifecycle operation.

Save this module beside `latest-request.js` as `workspace-results.js`. Supply an
element and `loadItems(query, { signal })` returning records with unique, stable
`id` and `name` values. The example uses the native `@mnjs/data` Collection and
its DataApi, configured on the two collection-aware View classes.

<!-- executable-example: application-child-data-refresh -->
```javascript
import { Application, CollectionView, View } from 'marionette';
import { Collection, DataApi } from '@mnjs/data';
import { createLatestRequest } from './latest-request.js';

const Card = View.extend({
  tagName: 'li',
  template: () => '',
  modelEvents: { 'change:name': 'render' },
  onRender() { this.el.textContent = this.model.get('name'); }
});
const Cards = CollectionView.extend({ tagName: 'ul', childView: Card });
Card.setDataApi(DataApi);
Cards.setDataApi(DataApi);

const Sidebar = View.extend({
  template: () => '<label>Sidebar note<input></label>'
});
const Shell = View.extend({
  template: () => '<p role="status">Ready</p><section class="results"></section>' +
    '<aside></aside>',
  regions: { results: '.results', sidebar: 'aside' },
  showStatus(message) { this.el.querySelector('[role="status"]').textContent = message; }
});

export function createWorkspaceResults({ el, loadItems }) {
  const items = new Collection();
  let requests;
  let generation = 0;
  let showStatus;
  const List = Application.extend({
    onStart(app, options) {
      requests?.dispose();
      generation += 1;
      showStatus = options.showStatus;
      this.showView(new Cards({ collection: items }));
      requests = createLatestRequest({
        load: loadItems,
        commit(rows) {
          const current = new Map(items.map(model => [model.get('id'), model]));
          const order = new Map(rows.map((row, index) => [row.id, index]));
          items.remove(items.models.filter(model => !order.has(model.get('id'))));
          for (const row of rows) { current.get(row.id)?.set(row); }
          items.add(rows.filter(row => !current.has(row.id)));
          items.sort((left, right) => order.get(left.get('id')) - order.get(right.get('id')));
        }
      });
    },
    onStop() { generation += 1; requests?.dispose(); },
    onBeforeDestroy() { generation += 1; requests?.dispose(); },
    async refresh(query) {
      if (!this.isRunning()) { return false; }
      const ownGeneration = ++generation;
      showStatus('Loading…');
      try {
        const committed = await requests.run(query);
        if (ownGeneration !== generation || !this.isRunning()) { return false; }
        if (committed) { showStatus('Ready'); }
        return committed;
      } catch (error) {
        if (ownGeneration !== generation || !this.isRunning()) { return false; }
        showStatus('Could not load. Try again.');
        return false;
      }
    },
    cancelRefresh() { generation += 1; requests?.cancel(); }
  });
  const Side = Application.extend({
    onStart() { this.showView(new Sidebar()); }
  });
  const list = new List();
  const sidebar = new Side();
  const Workspace = Application.extend({
    initialize() {
      this.addChildApp('list', list);
      this.addChildApp('sidebar', sidebar);
    },
    onBeforeStart() { this.showView(new Shell()); },
    async prepareStart(options, { signal }) {
      const shell = this.getView();
      const listStarted = await list.start({
        region: shell.getRegion('results'), showStatus: message => shell.showStatus(message)
      });
      if (signal.aborted) { return; }
      if (!listStarted) { throw new Error('List startup was superseded'); }
      const sidebarStarted = await sidebar.start({ region: shell.getRegion('sidebar') });
      if (signal.aborted) { return; }
      if (!sidebarStarted) { throw new Error('Sidebar startup was superseded'); }
    }
  });
  const application = new Workspace({ region: { el } });
  return { application, list, sidebar, items,
    refresh(query) { return list.refresh(query); },
    cancelRefresh() { list.cancelRefresh(); }
  };
}
```

Call `await workspace.application.start()` once, then call
`await workspace.refresh(query)` for each results load. The list's Collection
retains Models for surviving ids, so their card Views remain in place while
names and ordering change. The sidebar View and its input are untouched. While
a replacement is pending, both the existing cards and sidebar remain visible.
The result is assigned as text, so a record name is not interpreted as HTML.

Each refresh cancels the previous list request. The controller checks its
`AbortSignal` after the loader settles, including when a loader ignores abort.
The list's generation check also suppresses late success and failure status
updates. A current failure shows a retry message and leaves displayed cards
alone; the next refresh can retry. `cancelRefresh()` invalidates the status
update and cancels the request without clearing the list.

The parent registers both children once and starts them explicitly with Regions
from the current shell. Parent stop stops the children and destroys their Views;
parent destroy destroys both children. A later parent start creates a new shell
and starts the same children with its new Regions. Call `items.destroy()` after
destroying the workspace; this factory owns the Collection. If one child fails
startup, explicitly stop or destroy the workspace before abandoning it: child
startup is not transactional.

Use `restart()` when the feature's active run must end, such as changing its host
Region or resetting the whole workspace. Restart destroys the shell, list cards,
and sidebar input; it is unsuitable for a results refresh that must preserve
them. The parent's preparation signal covers startup only. List refreshes have
their own request lifetime and do not become Application preparation merely
because the list is owned by an Application. See [child ownership](./marionette.application.md#application-ownership)
and [effect lifetimes](./application-effects.md#choose-the-lifetime-first).

## Refresh a collection and preserve the editor

Save this module beside `latest-request.js` as `results-feature.js`. Supply an
element, a borrowed `@mnjs/data` Collection, and `loadItems(query, { signal })`
returning records with stable `id` and `name` fields. The collection must contain
only result data; the editor's draft has its own lifetime.

<!-- executable-example: application-data-refresh -->
```javascript
import { Application, CollectionView, View } from 'marionette';
import { DataApi } from '@mnjs/data';
import { createLatestRequest } from './latest-request.js';

const Row = View.extend({
  tagName: 'li',
  template: () => '',
  modelEvents: { 'change:name': 'render' },
  onRender() { this.el.textContent = this.model.get('name'); }
});
const Results = CollectionView.extend({ tagName: 'ul', childView: Row });
Row.setDataApi(DataApi);
Results.setDataApi(DataApi);
const Layout = View.extend({
  template: () => '<section class="results" aria-label="Results"></section>' +
    '<label>Draft<textarea></textarea></label>',
  regions: { results: '.results' }
});

export async function createResultsFeature({ el, items, loadItems, beforeStop = async() => {} }) {
  let requests;
  const Feature = Application.extend({
    onStart() {
      requests?.dispose();
      const layout = new Layout();
      this.showView(layout);
      layout.showChildView('results', new Results({ collection: items }));
      requests = createLatestRequest({
        load: loadItems,
        commit(rows) {
          const current = new Map(items.map(model => [model.get('id'), model]));
          const order = new Map(rows.map((row, index) => [row.id, index]));
          items.remove(items.models.filter(model => !order.has(model.get('id'))));
          for (const row of rows) { current.get(row.id)?.set(row); }
          items.add(rows.filter(row => !current.has(row.id)));
          items.sort((left, right) => order.get(left.get('id')) - order.get(right.get('id')));
        }
      });
    },
    prepareStop(options, context) { return beforeStop(options, context); },
    onStop() { requests?.dispose(); },
    onBeforeDestroy() { requests?.dispose(); }
  });
  const application = new Feature({ region: { el } });
  await application.start();
  return {
    application,
    refresh(query, options) { return requests.run(query, options); },
    cancel() { requests.cancel(); }
  };
}
```

Call `await feature.refresh(query)` for the initial results and subsequent filter
changes or retries. Keep the same feature and collection. The commit updates retained
Models, removes missing records, adds new records, then sorts to the response order.
This uses native Collection operations; it has no Backbone-style `Collection.set`.
Native `Collection.sort(comparator)` accepts the comparison function directly.
The response must have unique, stable ids with the same type across loads and the
initial collection: numeric `1` and string `'1'` identify different records.
Surviving row Views keep their identity;
updating the results does not rerender the layout or
replace the editor. Rows removed by the new result are intentionally destroyed.
Record names are assigned as text rather than interpolated into HTML.

As in [the effects pattern](./application-effects.md), requests remain active while
stop permission is pending. A rejected permission leaves them active. Successful
stop disposes the request controller and destroys the Views; destruction also
disposes it. A subsequent start creates fresh Views and a fresh request controller,
while the borrowed collection survives. These hooks also work when an owning
Application stops the feature. The caller supplies and disposes the collection;
this feature borrows it.
If `start()` supersedes pending stop permission, it can run `onStart()` again
without `onStop()`. Each start disposes the previous controller before replacing it.

Use one controller for each independently replaceable result. Sharing one controller
between unrelated list and detail loads would make them cancel each other.
The [routing guide](./routing.md#load-the-latest-page-and-discard-stale-work) uses
this same module with a View-replacement commit.

Working synchronous registration, rendering, and collection callbacks are required.
A throwing commit aborts without rollback; this example does not make View lifecycle
asynchronous or provide recovery from partial rendering.

## Verify the integration

The [installed fixture](https://github.com/marionettejs/marionette/blob/master/test/fixtures/docs-routing/refresh.mjs) runs these exact
modules against packaged Marionette and native data. It checks retained identities,
response ordering, cancellation, retry, stop permission, and ownership cleanup.
The [browser check](https://github.com/marionettejs/marionette/blob/master/test/browser/application-refresh.spec.mjs) also verifies
editor focus, selection, and draft preservation in Chromium, Firefox, and WebKit.

```sh
npm run test:fixtures -- --fixture docs-routing
npm run test:browser -- test/browser/application-refresh.spec.mjs
```
