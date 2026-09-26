# Compose a Marionette application

Build around owners that Marionette can compose and release. Views own DOM and
interactions; Regions own placement and replacement; CollectionViews own repeated
children; Applications own feature activation, readiness, and child Applications.
Use these contracts before introducing application lifecycle machinery.

## Choose the owner before writing the async function

| Work | Owner and pattern |
| --- | --- |
| Render a synchronous component | A View shown through a Region. No Application is required just to mount it. |
| Show loading, await initial data, then present a feature | An Application: `onBeforeStart` shows the loading shell, `prepareStart(options, { signal })` returns readiness data, and `onStart` consumes that result. |
| Replace an independently loaded detail screen | A child Application in the layout's detail Region. End the previous selection and start the current one; preserve the surrounding layout. |
| Refresh results while keeping an active editor and sibling panes | An explicit request operation on the existing owner. Use a request controller when replacement requests need ordering independent of feature activation. |
| Fetch a feed, coordinate pagination/retry, submit a multi-step workflow, or activate a route | A feature Application coordinates services and state; Views render supplied sources and emit intent. Being able to abort a request in View destruction does not justify putting the workflow there. |
| Share an interaction among Views | A Behavior owned by each host View. |
| Coordinate nonvisual state, events, or Radio bindings | A focused MnObject when its lifecycle and event contracts are useful. |
| Transform values or call a service | A plain function or service; it does not own the screen's lifecycle. |

An async function that displays loading, awaits data, and mounts the feature is a
reason to examine whether it has recreated Application startup. Begin with
`prepareStart`; depart from it only when the operation has a different lifetime.
An arbitrary Promise does not by itself need an Application. Requests that refresh
an already-active feature are a separate case, not the default startup recipe.

Keep readiness in `prepareStart`, `prepareStop`, and `prepareDestroy` when it belongs
to those transitions. Their signals cover the pending transition. `onStart` and
other completion hooks are synchronous notifications. After an await, respect the
signal before performing application side effects. Returning readiness data lets
Marionette suppress obsolete completion before calling `onStart`.

The [development starter](./development.md) demonstrates initial collection
readiness and a separately loaded detail Application. The
[Application examples](./marionette.application.md#application-lifecycle) explain
readiness and failure; [feature refresh](./application-refresh.md) covers the
explicit exception that retains an active screen.

## A complete paginated feature

Save this module as `feed.js`. It demonstrates
`RootApplication → FeedApplication → FeedView → CollectionView → ArticleView`.
The root owns the feed's active lifetime. The feed owns requests, records, and
observable status; its Views render supplied sources and emit pagination/retry intent.

Put transport in `feed-api.js`. This example expects `/api/feed?page=1` to return
`{ items, hasNext }`, with stable unique item IDs and text titles. Adapt that endpoint
to your backend. The client does not own Views, feature state, or request scheduling.

<!-- executable-example: application-feed-api -->
```javascript
export const feedApi = {
  async loadPage(page, { signal }) {
    const response = await fetch(`/api/feed?page=${encodeURIComponent(page)}`, { signal });
    if (!response.ok) throw new Error(`Feed request failed: ${response.status}`);
    return response.json();
  }
};
```

The feature imports that client directly. Constructor options configure the mounting
Region; services do not need to pass through the parent. A request may ignore abort;
obsolete results still cannot commit. Initial loading uses preparation. Pagination
is an operation of the running FeedApplication, so the surrounding editor stays
mounted.

<!-- executable-example: application-feed-composition -->
```javascript
import { Application, CollectionView, View, setDataApi, setStateApi } from 'marionette';
import { Collection, Model, DataApi, StateApi } from '@mnjs/data';
import { feedApi } from './feed-api.js';

// Put this configuration in the application's setup module, before creating owners.
setDataApi(DataApi);
setStateApi(StateApi);

const ArticleView = View.extend({
  tagName: 'li',
  template: () => '<h2></h2>',
  ui: { title: 'h2' },
  modelEvents: { 'change:title': 'showTitle' },
  onRender() { this.showTitle(); },
  showTitle() {
    if (this.isRendered()) this.getUI('title')[0].textContent = this.model.get('title');
  }
});
const ArticlesView = CollectionView.extend({ tagName: 'ul', childView: ArticleView });

export const FeedView = View.extend({
  template: () => '<p role="status"></p><div data-articles></div>' +
    '<button data-previous>Previous</button><button data-next>Next</button>' +
    '<button data-retry hidden>Retry</button>',
  regions: { articles: '[data-articles]' },
  ui: { status: '[role="status"]', previous: '[data-previous]', next: '[data-next]', retry: '[data-retry]' },
  triggers: { 'click @ui.previous': 'previous', 'click @ui.next': 'next', 'click @ui.retry': 'retry' },
  stateEvents: { change: 'showStatus' },
  onRender() {
    this.showChildView('articles', new ArticlesView({ collection: this.collection }));
    this.showStatus();
  },
  showStatus() {
    if (!this.isRendered()) return;
    const { page, status, hasNext } = this.getState().toObject();
    this.getUI('status')[0].textContent = status === 'loading' ? 'Loading…'
      : status === 'error' ? 'Could not load. Try again.' : `Page ${page}`;
    this.getUI('previous')[0].disabled = page === 1;
    this.getUI('next')[0].disabled = !hasNext;
    this.getUI('retry')[0].hidden = status !== 'error';
  }
});

export const FeedApplication = Application.extend({
  initialize() { this.articles = new Collection(); },
  createState() { return new Model({ page: 1, status: 'loading', hasNext: false }); },
  onBeforeStart() {
    this.cancelRequest();
    const previous = this.getView();
    if (previous) this.stopListening(previous);
    this.getState().set({ page: 1, status: 'loading', hasNext: false });
    const view = new FeedView({ collection: this.articles, state: this.getState() });
    this.listenTo(view, 'next', () => this.requestPage(this.getState().get('page') + 1));
    this.listenTo(view, 'previous', () => this.requestPage(this.getState().get('page') - 1));
    this.listenTo(view, 'retry', () => this.requestPage(this.requestedPage));
    this.listenTo(view, 'before:destroy', () => {
      this.cancelRequest();
      this.stopListening(view);
      void this.stop().catch(console.error);
    });
    this.showView(view);
  },
  async prepareStart(options, { signal }) {
    this.requestedPage = 1;
    try { return await feedApi.loadPage(1, { signal }); }
    catch (error) {
      if (signal.aborted) return;
      // A load failure is a ready retry screen in this feature's product policy.
      return { error };
    }
  },
  onStart(app, options, result) {
    if (result.error) this.getState().set('status', 'error');
    else this.showPage(1, result);
  },
  requestPage(page) {
    // DOM events do not await handlers. Report unexpected application failures.
    void this.refresh(page).catch(console.error);
  },
  async refresh(page) {
    if (!this.isRunning() || this.getView()?.isDestroyed() || page < 1) return false;
    this.cancelRequest();
    this.requestedPage = page;
    const request = new AbortController();
    this.request = request;
    this.getState().set('status', 'loading');
    let result;
    try { result = await feedApi.loadPage(page, { signal: request.signal }); }
    catch (error) {
      if (request.signal.aborted) return false;
      this.getState().set('status', 'error');
      return false;
    } finally {
      if (this.request === request) this.request = undefined;
    }
    if (request.signal.aborted) return false;
    this.showPage(page, result);
    return true;
  },
  showPage(page, { items, hasNext }) {
    this.articles.reset(items);
    this.getState().set({ page, hasNext, status: 'ready' });
  },
  cancelRequest() { this.request?.abort(); this.request = undefined; },
  onStop() { this.cancelRequest(); },
  onBeforeDestroy() { this.cancelRequest(); },
  onDestroy() { this.articles.destroy(); }
});

const RootView = View.extend({
  template: () => '<h1>Articles</h1><section data-feed></section><label>Notes<textarea></textarea></label>',
  regions: { feed: '[data-feed]' }
});

export const RootApplication = Application.extend({
  initialize() {
    this.addChildApp('feed', new FeedApplication());
  },
  onBeforeStart() {
    const previous = this.getView();
    if (previous) this.stopListening(previous);
    const view = new RootView();
    this.listenTo(view, 'before:destroy', () => {
      this.stopListening(view);
      void this.stop().catch(console.error);
    });
    this.showView(view);
  },
  async prepareStart(options, { signal }) {
    const started = await this.getChildApp('feed').start({ region: this.getView().getRegion('feed') });
    if (signal.aborted) return;
    if (!started) throw new Error('Feed startup was superseded');
  }
});
```

At the entry point, construct `new RootApplication({ region: { el: host } })`
and await `root.start()`. Await `root.destroy()` when leaving. No separate collection
or request disposer is required. The imported service owns transport; the FeedApplication owns when its result may affect this
feature. There is no global event bus for this direct parent/child relationship.

`prepareStart` resolves to either loaded data or an explicit retry-screen result.
That product policy means an initial network error can leave an active, usable
Retry button. A feature that cannot activate without data should instead reject
preparation and let its parent present the failure. Unexpected synchronous render
and collection errors still propagate; they are not converted into load failures.

Pagination retains the feed View and sibling editor. It replaces the read-only
article rows. For editable rows that must retain identity, use
[list composition](./list-composition.md). Changes to
observable status update only controls. Retry repeats the failed requested page;
the displayed page changes only on success. Parent stop aborts work and destroys
screens. Restart creates new screens and loads page one; terminal destruction also
releases the owned collection and state. The pagination controller cancels replaceable requests within the running feature;
it does not replace the startup signal. Host replacement stops the affected
feature as well. Detached/reusable hosts need their own stated activation policy.

## Apply the same boundaries elsewhere

- **Views own presentation.** Use `ui`, `events`, `triggers`, and declarative source
  events. Forward child intent with `childViewTriggers` or `childViewEvents`; the
  Application subscribes with `listenTo`. See [events](./events.md).
- **Services own transport.** Import established application services directly.
  Inject a service when instances need different implementations. A service does
  not own feature activation or a View tree.
- **Give data one owner.** Domain records belong to the established data provider.
  Supplied sources are borrowed; `createState` sources are lifecycle-owned through
  StateApi. Release collections you create at destruction. See [state](./marionette.state.md).
- **Preserve only what the interaction requires.** Keep layouts mounted during
  refresh. Editable rows need stable identity and an explicit policy for external
  updates versus local drafts. See [list composition](./list-composition.md).
- **Use framework cleanup.** Parents own child Applications; Regions own Views.
  External widgets may return disposal handles, released by their Marionette
  owner. Avoid a second `{ mount, update, dispose }` API around a feature. See
  [resource cleanup](./resource-cleanup.md).

Working synchronous callbacks remain required; this does not introduce rollback
or recovery from synchronous callback failures. See the
[synchronous failure contract](./view.lifecycle.md#synchronous-failures).

Review owner choice alongside behavior. [Composition checks](./testing.md) should
exercise parent stop/destruction, Region replacement during a request, direct
source updates, and any draft/focus guarantees. Passing those checks does not
establish that fresh agents will select these owners; that needs a separate
[usability evaluation](../benchmarks/agent/evaluation-plan.md).
