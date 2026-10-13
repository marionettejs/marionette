import { createRouter, createRoutes, createBrowserHistory } from '/packages/router/dist/index.js';
import { createBackboneHistory } from './backbone-history.mjs';
import { Radio } from 'marionette';
import { createLegacyRoutes, createProductHistory } from './legacy-fixture.mjs';

const Backbone = window.Backbone;
const mode = window.fixtureOptions.mode;
const panel = document.querySelector('#panel');
const routes = createRoutes({
  interaction: '/alpha/patient/:patientId/interactions/:interactionId',
  interactions: '/alpha/patient/:patientId/interactions',
});
const events = [];
const errors = [];
const completed = [];
const gates = new Map();
const tasks = new Map();
let renderCount = 0;
let legacyCount = 0;
let eventRouter;
let channel;
let bridge;
let historyService;
let originalHostNavigate;
let bridgeRestored;
const historyChanges = [];

function render(text) {
  const fragment = document.createDocumentFragment();
  const heading = document.createElement('h1');
  heading.textContent = text;
  heading.tabIndex = -1;
  fragment.append(heading);
  for (let index = 0; index < 40; index++) {
    const row = document.createElement('button');
    row.id = `row-${index}`;
    row.textContent = `${text} row ${index}`;
    fragment.append(row);
  }
  panel.replaceChildren(fragment);
  renderCount++;
}
function legacyRender(text) { legacyCount++; render(text); }
async function dispatch(context) {
  events.push({ id: context.id, kind: context.kind, href: context.location.href, key: context.location.key,
    state: context.location.state, name: context.match?.name ?? null, info: context.info });
  if (!context.match) {return;}
  const id = context.match.params.interactionId ?? 'feed';
  const gate = gates.get(id);
  try {
    if (gate) {await gate.promise;}
    context.runIfCurrent(() => render(id));
  } finally { completed.push(id); }
}

if (window.fixtureOptions.seed) {
  for (const [index, entry] of window.fixtureOptions.seed.entries()) {
    history[index ? 'pushState' : 'replaceState'](entry.state, '', entry.href);
  }
}
let driver;
if (mode === 'backbone') {
  channel = Radio.channel('prototype-routing');
  eventRouter = createLegacyRoutes(Backbone, channel);
  channel.on('schedule', () => {
    legacyRender('legacy schedule');
    if (window.fixtureOptions.redirectLegacy) {go('redirected');}
  });
  channel.on('worklist', id => legacyRender(`legacy ${id}`));
  // Migrated family has no outbound EventRouter registration; one route owner.
  const inbound = new Backbone.Router();
  inbound.route('alpha/patient/:patientId/interactions(/:interactionId)', 'migrated', () => {});
  Backbone.history.start({ pushState: true, silent: true });
  if (window.fixtureOptions.withHistoryService) {
    historyService = createProductHistory(Backbone, window);
    historyService.events.on('change:route', route => historyChanges.push(route));
    if (window.fixtureOptions.redirectService) {
      historyService.events.on('change:route', route => {
        if (route.endsWith('/outer')) {go('inner');}
      });
    }
  }
  Backbone.history.loadUrl(); // Host replay before the core subscribes.
  originalHostNavigate = Backbone.history.navigate;
  bridge = createBackboneHistory(Backbone, window);
  driver = bridge;
} else {driver = createBrowserHistory(window);}

const router = createRouter({ routes, history: driver, dispatch, onError: error => errors.push(error.message) });
const started = router.start();

function go(id, options = {}) {
  const target = { name: 'interaction', params: { patientId: options.patientId ?? 'p1', interactionId: id } };
  const task = router.navigate(target, options);
  tasks.set(id, task);
  return task;
}
if (channel) {
  channel.on('patient:interaction', (patientId, interactionId, info) => {
    go(interactionId, { patientId, info });
  });
}

window.fixture = {
  router, started, events, errors, completed, tasks, historyChanges,
  get bridgeRestored() { return bridgeRestored; },
  get renderCount() { return renderCount; },
  get legacyCount() { return legacyCount; },
  go,
  reflect() { return router.reflect({ name: 'interactions', params: { patientId: 'p1' } }); },
  hold(id) { gates.set(id, Promise.withResolvers()); },
  release(id) { gates.get(id).resolve(); },
  reject(id) { gates.get(id).reject(new Error(`failed ${id}`)); },
  legacy(event, ...args) { channel.trigger(event, ...args); },
  hostNavigate(path, options = {}) { Backbone.history.navigate(path, options); },
  hostReplay(path) { Backbone.history.loadUrl(path); },
  detachBridge() { router.dispose(); bridge.dispose(); bridgeRestored = Backbone.history.navigate === originalHostNavigate; },
  productBack() { historyService.goBack(() => historyChanges.push('empty')); },
  presentTarget(id = 'row-20') {
    const target = document.getElementById(id);
    if (!target) {return false;}
    target.scrollIntoView({ block: 'center' });
    target.focus({ preventScroll: true });
    return true;
  },
  twoFrames: () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  dispose() {
    router.dispose();
    bridge?.dispose();
    bridgeRestored = Backbone.history.navigate === originalHostNavigate;
    historyService?.destroy();
    eventRouter?.destroy();
    channel?.off();
    if (mode === 'backbone') {Backbone.history.stop();}
  },
};
await started;
window.fixtureReady = true;
