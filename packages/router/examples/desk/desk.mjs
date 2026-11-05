import { Application, View } from 'marionette';
import { Router, RouteApplication } from '@mnjs/router';

function presentationView(presentation) {
  const element = document.createElement('p');
  element.dataset.presentation = presentation.kind;
  element.textContent = presentation.kind === 'content' ? presentation.value : presentation.message ?? presentation.kind;
  return new View({ el: element });
}

// Feature-owned first-presentation contract. A replacement before first ready
// shares this promise; a later refresh does not reopen already-settled readiness.
const ReloadingPage = Application.extend({
  initialize() { this.presentation = null; },
  onBeforeStart() {
    this.presentation ??= Promise.withResolvers();
    this.showView(presentationView({ kind: 'loading' }));
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
    this.showView(presentationView(presentation));
    this.presentation.resolve(presentation);
  },
  onStop() {
    this.presentation?.resolve({ kind: 'stopped' });
    this.presentation = null;
  },
  initialPresentation() { return this.presentation.promise; },
});

export function createDesk({ main, side, driver, load = async id => `Item ${id}` }) {
  const frame = new Application({ region: { el: main } });
  const router = frame.addChildApp('navigation', new Router({ driver, routes: {
    desk: { path: '/:desk', meta: { shell: 'desk' } },
  } }));
  const tools = frame.addChildApp('tools', new Application());
  const Feature = RouteApplication.withRouter(router);
  let activity;
  const Catalog = Feature.extend({
    routeParent: 'desk',
    routes: { item: { path: 'catalog/:id', handler: 'showItem' } },
    initialize() {
      this.page = this.addChildApp('page', new ReloadingPage({ region: frame.getRegion() }));
    },
    async showItem(match, { signal }) {
      await this.start();
      signal.throwIfAborted();
      activity?.stop();
      if (this.desk !== match.params.desk || this.item !== match.params.id) {
        this.page.stop();
        this.desk = match.params.desk;
        this.item = match.params.id;
      }
      const starting = this.page.start({ id: match.params.id, load });
      const presented = this.page.initialPresentation();
      await starting; // May fulfill false because the page replaced its own work.
      const outcome = await presented;
      signal.throwIfAborted();
      if (outcome.kind === 'stopped') { throw new Error('Required presentation stopped'); }
      return outcome;
    },
  });
  const catalog = frame.addChildApp('catalog', new Catalog());

  const Activity = Feature.extend({
    routeParent: 'desk',
    routes: { activity: { path: 'activity', handler: 'showActivity' } },
    initialize() {
      // Sidebar feature lives below tools, while URL ancestry is still /:desk.
      this.page = this.addChildApp('page', new Application({ region: { el: side } }));
    },
    async showActivity(_match, { signal }) {
      await tools.start();
      signal.throwIfAborted();
      await this.start();
      signal.throwIfAborted();
      await this.page.start();
      signal.throwIfAborted();
      this.page.showView(presentationView({ kind: 'content', value: 'Activity inspector' }));
    },
  });
  return {
    frame, router, catalog, tools,
    mountActivity() {
      if (!activity || activity.isDestroyed()) { activity = tools.addChildApp('activity', new Activity()); }
      return activity;
    },
    async start() { await frame.start(); await router.start(); return frame; },
  };
}
