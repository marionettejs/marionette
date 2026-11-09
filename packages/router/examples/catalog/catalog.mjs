import { Application, View } from 'marionette';
import LitDomApi from '@mnjs/adapters/dom/lit-html';
import { html } from 'lit-html';

const CatalogView = View.extend({
  template: ({ title }) => html`<h1>${title}</h1>`,
}).setDomApi(LitDomApi);

export const catalogRoutes = {
  catalog: {
    path: '/catalog{/:id}?',
    handler: 'routeTo',
    meta: { area: 'catalog' },
  },
};

// An ordinary feature Application; route registration stays explicit in its caller.
export const Catalog = Application.extend({
  async prepareStart({ id, routeSignal } = {}, { signal }) {
    const loadItem = this.getOption('loadItem');
    const current = routeSignal ? AbortSignal.any([signal, routeSignal]) : signal;
    const title = id === undefined ? 'Catalog' : await loadItem(id, { signal: current });
    current.throwIfAborted();
    return title;
  },
  onStart(_app, { routeSignal } = {}, title) {
    if (routeSignal?.aborted) { return; }
    this.showView(new CatalogView({ model: { title } }));
  },
  routeTo(match) {
    return this.restart({ id: match.params.id, routeSignal: match.signal });
  },
});
