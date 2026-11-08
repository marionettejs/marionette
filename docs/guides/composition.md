# Compose an application feature

Use the existing project's compatible renderer, data runtime, router and build setup. With none chosen, follow the [Vite/@mnjs/html quick start](../quick-start.md) and add [@mnjs/data](../integrations/setup.md) when observation/shared state is useful; plain snapshots also work. This installed-app example combines a managed list, detail Region and coordinated readiness. It needs no framework repository checkout.

## A complete starting point

After quick-start setup, install the matching `@mnjs/data` version, keep `<div id="app"></div>` in `index.html`, and use this as `main.js`. Replace `loadItems` with your API layer; it should accept the preparation signal when transport cancellation is supported.

Render useful content as soon as its required data is ready; use Applications when async work needs feature-level coordination and Views for local requests, loading independent sections without blocking ready UI while preserving cleanup, error handling and [stale-result protection](async-requests.md).

Use `@mnjs/html` for template markup and values, and View `events`/`triggers` for interactions. The row below keeps selection in a View method and emits intent to its owner. `@mnjs/html` rejects template event bindings; declare handlers on the View.

```js
import { Application, CollectionView, View, setDataApi, setDomApi } from 'marionette';
import { Collection, DataApi } from '@mnjs/data';
import HtmlDomApi from '@mnjs/html/marionette';
import { html } from '@mnjs/html';

setDomApi(HtmlDomApi);
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

The Region mounts the layout; its Regions own list/detail replacement. The `@mnjs/html` DOM adapter leaves the configured event delegator in place. Here, in the native DOM handler, `event.delegateTarget` is the matched button; `event.target` may be its nested label/icon. View bindings follow the View's lifetime while `@mnjs/html` updates its descendants. Explicit child mappings forward the string ID unchanged to `viewEvents`; they add no child argument.

Selection replaces only detail. `restart()` retains the layout but resets rows/selection here. `stop()` destroys the owned UI while keeping the Application reusable; `destroy()` ends it and releases its private Collection. Borrowed data needs its own owner. Continue to [Records](../records.md) for loading/retry UI or [retained restart](retained-restart.md) for row/input identity.

## Load a detail page in stages

An order is required to render this page; shipments are independent secondary
content. The services below return decoded data, with `loadOrder` returning `null`
only for a confirmed HTTP 404. A network/server failure rejects instead, so
"not found" never disguises "unavailable". Replace the sample services with your
API layer, including response validation.

The page owns order navigation; its child View owns shipment loading and retry.
Each checks a request revision on both success and failure, including teardown.
Abort saves transport work when supported; revision checks remain necessary when
a service ignores it. A host can call `page.load(nextId)` for another order or
replace the page through its Region without allowing late results to affect the
new destination.

```js
import { Region, View } from 'marionette';
import HtmlDomApi from '@mnjs/html/marionette';
import { html } from '@mnjs/html';

const Shipments = View.extend({
  initialize() { this.revision = 0; this.status = 'loading'; this.shipments = []; },
  templateContext() { return { status: this.status, shipments: this.shipments }; },
  template: ({ status, shipments }) => html`<h2>Shipments</h2>
    ${status === 'loading' ? html`<p role="status">Loading shipments…</p>` :
      status === 'unavailable' ? html`<p role="alert">Shipments unavailable.</p>
        <button type="button" class="retry">Retry shipments</button>` :
        html`<ul>${shipments.map(shipment => html`<li>${shipment.id}: ${shipment.status}</li>`)}</ul>
          ${shipments.length ? '' : html`<p>No shipments yet.</p>`}`}`,
  events: { 'click .retry': 'load' },
  async load() {
    if (this.isDestroyed()) { return false; }
    const revision = ++this.revision;
    this.controller?.abort();
    const controller = this.controller = new AbortController();
    const orderId = String(this.getOption('orderId'));
    this.status = 'loading';
    this.render();
    let shipments;
    try {
      shipments = await this.getOption('loadShipments')(orderId, { signal: controller.signal });
    } catch (error) {
      if (this.isDestroyed() || revision !== this.revision) { return false; }
      this.status = 'unavailable';
      this.render();
      return false;
    } finally {
      if (this.controller === controller) { this.controller = undefined; }
    }
    if (this.isDestroyed() || revision !== this.revision) { return false; }
    this.shipments = shipments;
    this.status = 'ready';
    this.render();
    return true;
  },
  onBeforeDestroy() { ++this.revision; this.controller?.abort(); }
}).setDomApi(HtmlDomApi);

const OrderPage = View.extend({
  initialize() { this.revision = 0; this.status = 'loading'; },
  templateContext() { return { status: this.status, order: this.order }; },
  template: ({ status, order }) => status === 'ready'
    ? html`<h1>Order ${order.id}</h1><p>Total: ${order.total}</p>
        <section class="shipments" aria-label="Order shipments"></section>`
    : html`<p role="status">${status === 'not-found' ? 'Order not found.' :
      status === 'unavailable' ? 'Order unavailable. Try again.' : 'Loading order…'}</p>`,
  regions: { shipments: '.shipments' },
  async load(inputId) {
    if (this.isDestroyed()) { return false; }
    const id = String(inputId);
    const revision = ++this.revision;
    this.controller?.abort();
    const controller = this.controller = new AbortController();
    this.status = 'loading';
    this.render(); // Destroys the previous order's owned shipment View.
    let order;
    try {
      order = await this.getOption('loadOrder')(id, { signal: controller.signal });
    } catch (error) {
      if (this.isDestroyed() || revision !== this.revision) { return false; }
      this.status = 'unavailable';
      this.render();
      return false;
    } finally {
      if (this.controller === controller) { this.controller = undefined; }
    }
    if (this.isDestroyed() || revision !== this.revision) { return false; }
    this.order = order;
    this.status = order === null ? 'not-found' : 'ready';
    this.render();
    if (order === null) { return false; }
    const shipments = new Shipments({ orderId: id, loadShipments: this.getOption('loadShipments') });
    this.showChildView('shipments', shipments);
    void shipments.load(); // Handles current and stale request failures.
    return true; // Required content is ready; shipments do not delay it.
  },
  onBeforeDestroy() { ++this.revision; this.controller?.abort(); }
}).setDomApi(HtmlDomApi);

const orderRegion = new Region({ el: document.createElement('main') });
const page = new OrderPage({
  loadOrder: async id => ({ id, total: '$42' }),
  loadShipments: async () => [{ id: 'S1', status: 'In transit' }]
});
orderRegion.show(page);
await page.load('A100');
```

Mount `orderRegion` on the actual detail-page host in your application. A current
order failure returns `false` with recoverable UI; retry by calling `page.load(id)`.
Shipment retry is local and leaves the order content intact. Destroy the Region
when its owner ends. Reserve suitable space for `.shipments` in application CSS
(for example, a design-specific `min-block-size`) to reduce layout shift; Region
does not measure or reserve layout space automatically.

## Choose the owning boundary

For data-driven lists, default to CollectionView with child Views for managed identity and lifetime. It is not a core API requirement; simple/static repetition in an owning template remains valid. Use Views/Regions for composition and View `events`/`triggers`/`ui` for normal interactions. [Architecture](../architecture.md#let-views-and-regions-manage-presentation) explains manual HTML insertion, renderer ownership and supported DOM integrations.

Application fits coordinated readiness and start/stop lifetime; a local request or simple host-router replacement need not use it. See [architecture](../architecture.md#prepare-a-feature-then-activate-its-ui) for lifecycle choices and [routing](routing.md) for destination ownership.

## Look up the contract you need

- [Model snapshots and data contracts](../packages/data.md#read-and-mutate-attributes).
- [Template data and templateContext](../api/view.md#construction-and-options).
- [DOM events](../api/shared/view-bindings.md#dom-events) and [UI bindings](../api/shared/view-bindings.md#ui-bindings).
- [Full task index and focused lookup](../agents.md#local-contract-lookup).
