import { View } from 'marionette';
import { RouteApplication } from '@mnjs/router';
import LitDomApi from '@mnjs/adapters/dom/lit-html';
import { html } from 'lit-html';

const CatalogView = View.extend({
  template: ({ title }) => html`<h1>${title}</h1>`,
}).setDomApi(LitDomApi);

const Item = RouteApplication.extend({
  routes: {
    '': { name: 'item', handler: 'showItem' },
    'reviews': { name: 'reviews', handler: 'showReviews' },
  },
  async prepareStart({ id, loadItem }, { signal }) {
    const title = await loadItem(id, { signal });
    signal.throwIfAborted();
    return title;
  },
  onStart(_app, _options, title) { this.title = title; },
  showItem() { this.showView(new CatalogView({ model: { title: this.title } })); },
  showReviews() { this.showView(new CatalogView({ model: { title: `Reviews: ${this.title}` } })); },
});

// The feature declares its children and URL branches together. Item owns loading;
// the mount starts/reuses it by id before dispatching its local leaf handler.
export const Catalog = RouteApplication.extend({
  childApps: { item: Item },
  routes: {
    '/catalog': { name: 'catalog', handler: 'showCatalog', meta: { area: 'catalog' } },
    '/catalog/:id': { mount: 'item', namespace: 'catalog', meta: { area: 'catalog' } },
    '/products/:id': { name: 'legacyItem', redirect: { name: 'catalog:item' } },
  },
  childRouteOptions() { return { loadItem: this.getOption('loadItem') }; },
  showCatalog() { this.showView(new CatalogView({ model: { title: 'Catalog' } })); },
});
