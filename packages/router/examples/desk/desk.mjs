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
  routeParent: 'desk',
  routes: {
    catalog: { path: 'catalog', handler: 'showCatalog' },
    item: { path: 'catalog/:id', handler: 'showItem' },
  },
  initialize() {
    this.addChildApp('page', new ReloadingPage({ region: this.getRegion() }));
  },
  async showItem(match) {
    const { signal } = match;
    signal.throwIfAborted();
    this.getOption('tools').getChildApp('activity')?.stop();
    const page = this.getChildApp('page');
    if (this.desk !== match.params.desk || this.item !== match.params.id) {
      page.stop();
      this.desk = match.params.desk;
      this.item = match.params.id;
    }
    const starting = page.start({ id: match.params.id, load: this.getOption('load') });
    const presented = page.initialPresentation();
    await starting; // May fulfill false because the page replaced its own work.
    const outcome = await presented;
    signal.throwIfAborted();
    if (outcome.kind === 'stopped') { throw new Error('Required presentation stopped'); }
    return outcome;
  },
  showCatalog(match) {
    match.signal.throwIfAborted();
    this.getOption('tools').getChildApp('activity')?.stop();
    this.getChildApp('page').stop();
    this.showView(new PresentationView({
      model: { kind: 'content', value: `Catalog ${match.params.desk}` },
    }));
  },
});

export const Activity = RouteApplication.extend({
  routeParent: 'desk',
  routes: {
    activity: { path: 'activity', handler: 'showActivity' },
  },
  async showActivity(match) {
    const { signal } = match;
    await this.getOption('tools').start();
    signal.throwIfAborted();
    return this.start({ routeSignal: signal });
  },
  onStart(_app, { routeSignal } = {}) {
    if (routeSignal?.aborted) { return; }
    this.showView(new PresentationView({
      model: { kind: 'content', value: 'Activity inspector' },
    }));
  },
});

export const Desk = Application.extend({
  load: async id => `Item ${id}`,
  initialize(options) {
    const router = this.addChildApp('navigation', new Router({
      driver: options.driver,
      routes: {
        desk: {
          path: '/:desk',
          meta: { shell: 'desk' },
          redirect: ({ params }) => ({ name: 'catalog', params }),
        },
      },
    }));
    const tools = this.addChildApp('tools', new Application({ region: { el: options.side } }));
    this.addChildApp('catalog', new Catalog({
      router,
      tools,
      region: { el: options.main },
      load: this.getOption('load'),
    }));
  },
  async prepareStart(_options, { signal }) {
    await this.getChildApp('catalog').start();
    signal.throwIfAborted();
  },
});
