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
    const existing = new Map(this.articles.map(model => [model.id, model]));
    const order = new Map(items.map((item, index) => [item.id, index]));
    this.articles.remove(this.articles.models.filter(model => !order.has(model.id)));
    for (const item of items) {
      if (existing.has(item.id)) existing.get(item.id).set(item);
      else this.articles.add(item);
    }
    this.articles.sort((left, right) => order.get(left.id) - order.get(right.id));
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

Pagination retains the feed View, list, and surviving row identities. Changes to
observable status update only controls. Retry repeats the failed requested page;
the displayed page changes only on success. Parent stop aborts work and destroys
screens. Restart creates new screens and loads page one; terminal destruction also
releases the owned collection and state. The pagination controller cancels replaceable requests within the running feature;
it does not replace the startup signal. Host replacement stops the affected
feature as well. Detached/reusable hosts need their own stated activation policy.

## Keep DOM and interaction with their View

Declare parent-owned selectors in `ui`. Use `triggers` for semantic actions and
`events` when the handler needs keyboard or input details. Use `triggerMethod` to
emit application intent. Forward child events through `childViewTriggers` or
`childViewEvents`; let the feature owner subscribe with `listenTo`.

A row should not close over the whole workspace's navigation function. A child
Application receives its Region and any borrowed source. Import established
application services directly; use injected services when instances actually need
different implementations. Do not pass the parent layout or callbacks that walk
its View tree. The parent
coordinates siblings through their public methods and events.

Render content through templates and `templateContext`. A View can update its own
named UI elements for input values, status, selection, and focus without rendering
again. This preserves editable DOM. An Application calls a View's presentation
method; it does not query or mutate that View's descendants itself.

A parent rerender destroys Region-owned children. Keep stable layouts mounted for
ordinary updates. CollectionView observes structural collection updates; do not
add a second subscription that rerenders the whole list after each mutation.

## Give data one authority and a stated lifetime

Domain records live in models/collections or the application's established data
provider. UI state lives in an explicitly owned or borrowed observable source when
several consumers need notification. View traversal is not a record store.

Choose an observable integration when records change independently of one control.
For a new application, `@mnjs/data` is the supported starting point. Plain snapshots
remain useful for static content. Do not grow a notification system around plain
arrays to avoid selecting a data provider.

Observe displayed fields through `modelEvents`, `collectionEvents`, or `stateEvents`
as appropriate. Distinguish a saved record from an unfinished draft. Define what
external changes do to a clean editor and a dirty editor, and verify both paths.
Avoid whole-View rendering during input handling.

Supplied sources are borrowed; `createState` sources are owned through StateApi.
A collection created by a feature must be released by that feature's lifecycle.
A caller-owned collection must be supplied explicitly and survive feature teardown.
Stopping an Application ends its run; decide separately whether records survive
until destruction or are reloaded during the next startup.

## Make framework composition sufficient for cleanup

A parent owns a child Application with `addChildApp` or `childApps`. A Region owns
its displayed View. Put cleanup in the corresponding lifecycle hooks so parent
stop/destroy and Region replacement work without a second caller-managed disposer.
Do not replace public lifecycle methods with forwarding wrappers.

Host lifetime, Application lifetime, and request lifetime are distinct. If another
owner can replace a feature's root, losing that root must invalidate its pending UI
work even before asynchronous feature teardown completes. Test that path directly.

A factory may construct and return a View or Application. It should not hide the
feature's state machine, subscriptions, and ownership behind a parallel
`{ mount, update, dispose }` API. Prefer ordinary exported definitions configured
with constructor/start options. Custom adapters and third-party widgets can expose
disposal handles: their Marionette owner acquires and releases those handles.

Use external effect scopes only for resources whose lifetime the framework does
not already manage. `listenTo` and declarative state/Radio bindings already manage
owner-lifetime subscriptions. A run-scoped subscription may need explicit release
at stop; do not silently extend it to the whole Application object's lifetime.

Working synchronous callbacks remain required. These rules do not introduce
constructor rollback, attempt-all cleanup, or synchronous recovery. Follow the
[synchronous failure contract](./view.lifecycle.md#synchronous-failures).

## Review behavior and composition together

For each feature, identify the data source, the View/Region tree, the Application
boundary when needed, and the owner of external resources. Explain helpers that
overlap a built-in responsibility. Review actual ownership rather than counting
framework classes or matching a reference solution's syntax.

Verify the boundary through its real owner:

- Replace a screen through its Region while work is pending; old results must not
  update the new screen or move focus.
- Stop and destroy a feature through its parent Application; check released
  resources and borrowed-source survival.
- Change shared records directly; all intended consumers must update.
- Edit a row while another changes or moves; preserve the surviving View, input,
  focus, and draft according to the declared policy.
- Add an independent pane or another source consumer without adding a second
  rendering, notification, or cleanup system.

Passing interactions do not establish good composition. Passing composition checks
do not establish agent usability. A fresh build/change/repair exercise is needed
to determine whether this teaching path leads agents to these choices.
