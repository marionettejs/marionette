# Refresh data with retained preparation

Use `restart({ query })` to rerun a feature's preparation while retaining its
layout, editor, active children, and displayed results. The newest preparation
wins; current failure rejects with previous presentation still active. Return data
from `prepareStart` and consume it in `onStart`. Stop followed by start performs
full teardown and reconstruction.

The collection example below uses this native contract. A separate request policy
remains useful for independent saves, pagination, and routing that must not replace
Application preparation. The helper in the next section serves those operations.

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
prevents an older `select()` continuation from starting its resource after
a newer selection replaces it. Marionette's preparation signal prevents
an obsolete load, even one that ignores abort, from reaching `onStart` and
showing its View. The parent shell stays mounted as selected Views change.
`false` means the selection was superseded or the owner stopped; a current
readiness failure rejects. An owner stop or destroy invalidates selection before a later child start.
Destroy the owning Application when the selector is released.

Use retained `restart({ id })` when old content should remain visible during loading.
Use explicit stop/start when changing selection intentionally ends the child run.

## Refresh a collection and preserve the editor

Save this module as `results-feature.js`. Supply an
element, a borrowed `@mnjs/data` Collection, and `loadItems(query, { signal })`
returning records with stable `id` and `name` fields. The collection must contain
only result data; the editor's draft has its own lifetime.

<!-- executable-example: application-data-refresh -->
```javascript
import { Application, CollectionView, View } from 'marionette';
import { DataApi } from '@mnjs/data';

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
  prepareStart({ query } = {}, { signal }) {
    if (query === undefined) return;
    return this.getOption('loadItems')(query, { signal });
  },
  onStart(app, options, rows) {
    const items = this.getOption('items');
    if (!this.getView()) {
      const layout = this.showView(new Layout());
      layout.showChildView('results', new Results({ collection: items }));
    }
    if (!rows) return;
    const current = new Map(items.map(model => [model.get('id'), model]));
    const order = new Map(rows.map((row, index) => [row.id, index]));
    items.remove(items.models.filter(model => !order.has(model.get('id'))));
    for (const row of rows) { current.get(row.id)?.set(row); }
    items.add(rows.filter(row => !current.has(row.id)));
    items.sort((left, right) => order.get(left.get('id')) - order.get(right.get('id')));
  }
});
```

Construct `new ResultsFeature({ region: { el }, items, loadItems })`
and await `feature.start()`. Call `await feature.restart({ query })` for the initial results and subsequent filter
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

Stop and destroy invalidate preparation immediately and remove the selected UI.
A subsequent start creates fresh Views while the borrowed collection survives.
The caller owns and disposes that collection.

Use `restart()` without a query to supersede a pending load without changing
results. Handle current rejection at the caller. Every preparation result is
committed only by its current `onStart`; transports may ignore cancellation safely.
No request counter or application-owned AbortController is needed for this workflow.
Independent operations still need their own policy; sharing preparation between
unrelated list and detail loads would make them cancel each other.

Working synchronous registration, rendering, and collection callbacks are required.
A throwing commit aborts without rollback; this example does not make View lifecycle
asynchronous or provide recovery from partial rendering.

## Verify the integration

The [installed fixture](https://github.com/marionettejs/marionette/blob/master/test/fixtures/docs-routing/refresh.mjs) runs these exact
modules against packaged Marionette and native data. It checks retained identities,
response ordering, cancellation, retry, synchronous stop, and ownership cleanup.
The [browser check](https://github.com/marionettejs/marionette/blob/master/test/browser/application-refresh.spec.mjs) also verifies
editor focus, selection, and draft preservation in Chromium, Firefox, and WebKit.

```sh
npm run test:fixtures -- --fixture docs-routing
npm run test:browser -- test/browser/application-refresh.spec.mjs
```
