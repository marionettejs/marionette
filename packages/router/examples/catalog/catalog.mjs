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
  async routeTo(match, { signal }) {
    const loadItem = this.getOption('loadItem');
    const title = match.params.id === undefined ? 'Catalog' : await loadItem(match.params.id, { signal });
    signal.throwIfAborted();
    if (!await this.start()) { return; }
    signal.throwIfAborted();
    this.showView(new CatalogView({ model: { title } }));
  },
});
