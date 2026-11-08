# Compose an application feature

Use the existing project's compatible renderer, data runtime, router and build setup. With none chosen, follow the [Vite/Lit quick start](../quick-start.md) and add [@mnjs/data](../integrations/setup.md) when observation/shared state is useful; plain snapshots also work. This installed-app example combines a managed list, detail Region and coordinated readiness. It needs no framework repository checkout.

## A complete starting point

After quick-start setup, install the matching `@mnjs/data` version, keep `<div id="app"></div>` in `index.html`, and use this as `main.js`. Replace `loadItems` with your API layer; it should accept the preparation signal when transport cancellation is supported.

Use Lit for template markup and values; prefer View `events`/`triggers` for ordinary View interactions. The row below keeps selection in a View method and emits intent to its owner. Lit `@event` bindings also work and can stay in existing Lit behavior or integrations.

```js
import { Application, CollectionView, View, setDataApi, setDomApi } from 'marionette';
import { Collection, DataApi } from '@mnjs/data';
import LitDomApi from '@mnjs/adapters/dom/lit-html';
import { html } from 'lit-html';

setDomApi(LitDomApi);
setDataApi(DataApi);

const Row = View.extend({
  tagName: 'li',
  template: ({ id, title }) => html`<button type="button" class="select-item" data-id=${id}>
    <span aria-hidden="true">↗</span><span class="label">${title}</span>
  </button>`,
  modelEvents: { change: 'render' },
  events: { 'click .select-item': 'selectItem' },
  selectItem(event) { this.trigger('select', event.delegateTarget.dataset.id); }
});
const List = CollectionView.extend({
  tagName: 'ul', childView: Row,
  childViewTriggers: { select: 'select:item' }
});
const Detail = View.extend({
  template: ({ title }) => html`<h2>${title}</h2>`,
  modelEvents: { change: 'render' }
});
const Layout = View.extend({
  template: () => html`<div class="items"></div><section class="detail" aria-label="Item details"></section>`,
  regions: { items: '.items', detail: '.detail' },
  childViewTriggers: { 'select:item': 'select:item' }
});
const Feature = Application.extend({
  initialize() { this.items = new Collection(); },
  viewEvents: { 'select:item': 'showDetail' },
  async prepareStart(_options, { signal }) {
    return this.getOption('loadItems')({ signal });
  },
  onStart(_app, _options, records) {
    this.items.reset(records);
    if (!this.getView()) {
      const layout = this.setView(new Layout());
      layout.showChildView('items', new List({ collection: this.items }));
    }
    this.getView().showChildView('detail', new View({
      template: () => html`<p>Select an item.</p>`
    }));
    this.showView();
  },
  showDetail(itemId) {
    this.getView().showChildView('detail', new Detail({ model: this.items.get(itemId) }));
  },
  onDestroy() { this.items.destroy(); }
});
const app = new Feature({
  region: { el: '#app' },
  loadItems: async () => [{ id: 'alpha', title: 'First item' }]
});
await app.start();
```

The configured DataApi supplies model attributes to row/detail templates; use `templateContext` for View-local data.

The Region mounts the layout; its Regions own list/detail replacement. The Lit DOM adapter leaves the configured event delegator in place. Here, in the native DOM handler, `event.delegateTarget` is the matched button; `event.target` may be its nested label/icon. View bindings follow the View's lifetime while Lit updates its descendants. Explicit child mappings forward the string ID unchanged to `viewEvents`; they add no child argument.

Selection replaces only detail. `restart()` retains the layout but resets rows/selection here. `stop()` destroys the owned UI while keeping the Application reusable; `destroy()` ends it and releases its private Collection. Borrowed data needs its own owner. Continue to [Records](../records.md) for loading/retry UI or [retained restart](retained-restart.md) for row/input identity.

## Choose the owning boundary

For data-driven lists, default to CollectionView with child Views for managed identity and lifetime. It is not a core API requirement; simple/static repetition in an owning template remains valid. Use Views/Regions for composition and View `events`/`triggers`/`ui` for normal interactions. [Architecture](../architecture.md#let-views-and-regions-manage-presentation) explains manual HTML insertion, renderer ownership and supported DOM integrations.

Application fits coordinated readiness and start/stop lifetime; a local request or simple host-router replacement need not use it. See [architecture](../architecture.md#prepare-a-feature-then-activate-its-ui) for lifecycle choices and [routing](routing.md) for destination ownership.

## Look up the contract you need

- [Model snapshots and data contracts](../packages/data.md#read-and-mutate-attributes).
- [Template data and templateContext](../api/view.md#construction-and-options).
- [DOM events](../api/shared/view-bindings.md#dom-events) and [UI bindings](../api/shared/view-bindings.md#ui-bindings).
- [Full task index and focused lookup](../agents.md#local-contract-lookup).
