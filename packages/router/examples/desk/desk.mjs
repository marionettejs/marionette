import { Application, View } from 'marionette';
import { Router, RouteApplication } from '@mnjs/router';
import LitDomApi from '@mnjs/adapters/dom/lit-html';
import { html } from 'lit-html';

const PresentationView = View.extend({
  template: ({ kind, value, message }) => html`<p data-presentation=${kind}>${kind === 'content' ? value : message ?? kind}</p>`,
}).setDomApi(LitDomApi);

// Feature-owned first-presentation contract. A replacement before first ready
// shares this promise; a later refresh does not reopen already-settled readiness.
const ReloadingPage = Application.extend({
  initialize() { this.presentation = null; },
  onBeforeStart() {
    this.presentation ??= Promise.withResolvers();
    this.showView(new PresentationView({ model: { kind: 'loading' } }));
  },
  async prepareStart(options, { signal }) {
    try {
      const value = await options.load(options.id, { signal });
      signal.throwIfAborted();
      return { kind: 'content', value };
    } catch (error) {
      signal.throwIfAborted();
      // This example chooses an attached error presentation as a handled result.
      return { kind: 'error', message: error.message };
    }
  },
  onStart(_app, _options, presentation) {
    this.showView(new PresentationView({ model: presentation }));
    this.presentation.resolve(presentation);
  },
  onStop() {
    this.presentation?.resolve({ kind: 'stopped' });
    this.presentation = null;
  },
  initialPresentation() { return this.presentation.promise; },
});

export const Catalog = RouteApplication.extend({
  routes: {
    'catalog': { name: 'catalog', handler: 'showCatalog' },
    'catalog/:id': { name: 'item', handler: 'showItem' },
  },
  initialize() {
    this.addChildApp('page', new ReloadingPage({ region: this.getRegion() }));
  },
  async showItem(match) {
    const { signal } = match;
    signal.throwIfAborted();
    this.getOption('tools').getChildApp('activity')?.clear();
    const page = this.getChildApp('page');
    const starting = this.switchTo('page', {
      key: { desk: match.params.desk, id: match.params.id },
      signal,
      options: { id: match.params.id, load: this.getOption('load') },
    });
    const presented = page.initialPresentation();
    await starting; // May return undefined when the page replaces its own startup.
    const outcome = await presented;
    signal.throwIfAborted();
    if (outcome.kind === 'stopped') { throw new Error('Required presentation stopped'); }
    return outcome;
  },
  showCatalog(match) {
    match.signal.throwIfAborted();
    this.getOption('tools').getChildApp('activity')?.clear();
    this.clear();
    this.showView(new PresentationView({
      model: { kind: 'content', value: `Catalog ${match.params.desk}` },
    }));
  },
});

const ActivityPanel = RouteApplication.extend({
  routes: { '': { name: 'activity', handler: 'showActivity' } },
  showActivity() {
    this.showView(new PresentationView({
      model: { kind: 'content', value: 'Activity inspector' },
    }));
  },
});

// This independently owned root is started explicitly after lazy registration.
// Its mounted panel then follows ordinary keyed route activation.
export const Activity = RouteApplication.extend({
  childApps: { panel: ActivityPanel },
  routes: { 'activity': { mount: 'panel' } },
});

export const Desk = Application.extend({
  load: async id => `Item ${id}`,
  initialize(options) {
    const router = this.addChildApp('navigation', new Router({
      driver: options.driver,
      routes: {
        '/:desk': {
          name: 'desk',
          meta: { shell: 'desk' },
          redirect: { name: 'catalog' },
        },
      },
    }));
    const tools = this.addChildApp('tools', new Application({ region: { el: options.side } }));
    const catalog = this.addChildApp('catalog', new Catalog({
      tools,
      region: { el: options.main },
      load: this.getOption('load'),
    }));
    catalog.mountRoutes(router, { parent: 'desk' });
  },
  async prepareStart(_options, { signal }) {
    await this.getChildApp('catalog').start();
    signal.throwIfAborted();
  },
});
