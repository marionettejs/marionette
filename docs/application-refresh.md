# Refresh data without restarting a feature

This page applies after a feature has started. For initial loading followed by
presentation, use Application `onBeforeStart`, `prepareStart`, and `onStart` as
shown in [application composition](./application-composition.md). The controllers
below serve a different requirement: retain the active shell, editor, and sibling
owners while replacing only a data request.


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
The active Application creates and releases this helper and decides when to call it.
A View emits refresh intent; it does not acquire the helper to coordinate the feature.
`load(input, { signal })` is asynchronous; `commit(value, input)` and the optional
`fail(error, input)` are synchronous.

<!-- executable-example: application-latest-request -->
```javascript
export function createLatestRequest({ load, commit, fail }) {
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
        let value;
        try {
          value = await load(input, { signal: request.signal });
        } catch (error) {
          if (request.signal.aborted) { return false; }
          if (!fail) { throw error; }
          fail(error, input);
          return false;
        }
        if (request.signal.aborted) { return false; }
        commit(value, input);
        return true;
      } finally {
        releaseSignal();
        request.signal.removeEventListener('abort', releaseSignal);
        if (pending === request) { pending = undefined; }
      }
    }
  };
}
```

`run` resolves `true` after committing and `false` for canceled work, a disposed
controller, or a current load failure handled by `fail`. Without `fail`, a current
load failure rejects. A synchronous `commit` or `fail` failure always rejects;
handle it at the application boundary without treating a partially applied commit
as a retryable load failure. The post-await check also
protects against providers that ignore abort; a canceled Promise settles when
its loader settles. Cancellation does not force a non-cooperative loader to finish.

`cancel` aborts the pending request without clearing displayed data. `dispose`
also refuses future requests. External abort listeners are released on cancellation
even if the loader never settles. An already-aborted external signal leaves an
existing request alone. Old success, error, and cleanup continuations cannot
commit or discard a newer request's cancellation handle.
The external signal covers that pending request, not the feature's persistent effects.

## Select a resource with an explicit latest policy

Use this separate pattern when changing the selected resource intentionally
replaces the child screen. It ends the child's active run and destroys its old
View. Keep the persistent-shell pattern above for data changes that must retain
cards or drafts. Supply `loadResource(id, { signal })` returning an object with a
`name` string, and an element that hosts the selected child.

<!-- executable-example: application-latest-selection -->
```javascript
import { Application, View } from 'marionette';

const Resource = View.extend({
  template: () => '',
  onRender() { this.el.textContent = this.model.name; }
});
const SelectionShell = View.extend({
  template: () => '<section></section>',
  regions: { resource: 'section' }
});

const SelectedResource = Application.extend({
  async prepareStart({ id }, { signal }) {
    return this.getOption('loadResource')(id, { signal });
  },
  onStart(app, options, resource) { this.showView(new Resource({ model: resource })); }
});

export const ResourceSelection = Application.extend({
  initialize({ loadResource }) {
    this.latest = 0;
    this.addChildApp('selected', new SelectedResource({ loadResource }));
  },
  onBeforeStart() { this.showView(new SelectionShell()); },
  onStop() { this.latest++; },
  onBeforeDestroy() { this.latest++; },
  async select(id) {
    if (!this.isRunning()) return false;
    const selection = ++this.latest;
    const child = this.getChildApp('selected');
    await child.stop();
    if (selection !== this.latest || !this.isRunning()) return false;
    const shell = this.getView();
    if (!shell || shell.isDestroyed()) return false;
    const started = await child.start({ region: shell.getRegion('resource'), id });
    return selection === this.latest && started;
  }
});

```

Construct `new ResourceSelection({ region: { el }, loadResource })` and
start it with `await selector.start()` first, then call `await selector.select(id)` and
handle a current loader rejection at the caller. A new selection calls `stop()`
on the selected child immediately, canceling any pending child
startup, then starts only the latest selected id after stop completes. The token
prevents an older `select()` continuation from starting its resource when
concurrent calls share stop readiness. Marionette's preparation signal prevents
an obsolete load, even one that ignores abort, from reaching `onStart` and
showing its View. The parent shell stays mounted as selected Views change.
`false` means the selection was superseded or the owner stopped; a current
readiness failure rejects. An owner stop or destroy while `select()` awaits the
child stop also prevents a later child start.
Destroy the owning Application when the selector is released.

Repeated `restart({ id })` is unsuitable for rapid selection: compatible
in-flight restarts share the first operation and its original options. The
selection token is application code, not a Marionette framework API or a
framework-owned run signal. This example uses a lifecycle boundary because the
selected child screen is replaced; the list refresh above remains an individual
request within an active child.

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

export const ResultsFeature = Application.extend({
  onStart() {
    this.requests?.dispose();
    const items = this.getOption('items');
    const layout = new Layout();
    this.listenTo(layout, 'before:destroy', () => {
      this.requests?.dispose();
      this.stopListening(layout);
    });
    this.showView(layout);
    layout.showChildView('results', new Results({ collection: items }));
    this.requests = createLatestRequest({
      load: this.getOption('loadItems'),
      commit: rows => {
        const current = new Map(items.map(model => [model.get('id'), model]));
        const order = new Map(rows.map((row, index) => [row.id, index]));
        items.remove(items.models.filter(model => !order.has(model.get('id'))));
        for (const row of rows) { current.get(row.id)?.set(row); }
        items.add(rows.filter(row => !current.has(row.id)));
        items.sort((left, right) => order.get(left.get('id')) - order.get(right.get('id')));
      }
    });
  },
  prepareStop(options, context) { return this.getOption('beforeStop')?.(options, context); },
  onStop() { this.requests?.dispose(); },
  onBeforeDestroy() { this.requests?.dispose(); },
  refresh(query, options) {
    if (!this.isRunning() || !this.getView()) return Promise.resolve(false);
    return this.requests.run(query, options);
  },
  cancel() { this.requests?.cancel(); }
});
```

Construct `new ResultsFeature({ region: { el }, items, loadItems, beforeStop })`
and await `feature.start()`. Call `await feature.refresh(query)` for the initial results and subsequent filter
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
