import { createMarionette } from 'marionette';
import { Collection, DataApi, Model, StateApi } from '@mnjs/data';

const runtime = createMarionette();
runtime.setDataApi(DataApi);
runtime.setStateApi(StateApi);
const probes = [];
const liveInputs = [];
let control;
let controlProbe;

function invariant(value, message) {
  if (!value) { throw new Error(message); }
}

function track(value, kind = 'owner') {
  probes.push({ kind, ref: new WeakRef(value) });
  return value;
}

function keepInput(value) {
  liveInputs.push(track(value, 'input'));
  return value;
}

const Row = runtime.View.extend({
  template: data => `<input value="${data.id}">`,
  modelEvents: { change: 'render' },
  initialize() { track(this); track(this.el, 'element'); }
});
const List = runtime.CollectionView.extend({ childView: Row });

function collectionCycle() {
  const collection = keepInput(new Collection([{ id: 1 }, { id: 2 }, { id: 3 }]));
  collection.models.forEach(keepInput);
  const host = document.createElement('main');
  document.body.append(host);
  const region = track(new runtime.Region({ el: host }));
  const list = track(new List({ collection }));
  track(list.el, 'element');
  region.show(list);
  const survivor = list.children.findByModel(collection.at(1));
  collection.move(collection.at(0), 2);
  invariant(list.children.findByModel(survivor.model) === survivor, 'Reorder replaced a survivor');
  collection.remove(collection.at(0));
  keepInput(collection.add({ id: 4 }));
  list.render();
  invariant(survivor.isDestroyed(), 'Explicit render did not release old children');
  collection.reset([{ id: 5 }, { id: 6 }]);
  collection.models.forEach(keepInput);
  region.destroy();
  invariant(list.isDestroyed() && host.children.length === 0, 'List teardown failed');
  // Keep the source alive during owner collection: leaked subscriptions must
  // not disappear merely because the entire source/owner cycle is unreachable.
  collection.add({ id: 7 });
  host.remove();
}

function replacementCycle() {
  const host = document.createElement('main');
  const slots = [document.createElement('section'), document.createElement('section')];
  host.append(...slots);
  document.body.append(host);
  const [first, second] = slots.map(el => track(new runtime.Region({ el, replaceElement: true })));
  const child = track(new runtime.View({ template: () => '<button>Move</button>' }));
  track(child.el, 'element');
  first.show(child);
  second.show(first.detachView());
  first.destroy();
  invariant(second.currentView === child && !child.isDestroyed(), 'Previous owner disturbed adoption');
  second.destroy();
  invariant(child.isDestroyed(), 'Adopted child survived final teardown');
  host.remove();
}

async function applicationCycle() {
  const host = document.createElement('main');
  document.body.append(host);
  const region = keepInput(new runtime.Region({ el: host }));
  let settle;
  let view;
  let starts = 0;
  const App = runtime.Application.extend({
    onBeforeStart() {
      if (!settle) { return new Promise(resolve => { settle = resolve; }); }
    },
    onStart() {
      starts++;
      view = track(new runtime.View({ template: () => '<p>Ready</p>' }));
      track(view.el, 'element');
      this.showView(view);
    }
  });
  const app = track(new App({ region }));
  const child = track(new runtime.Application());
  app.addChildApp('child', child);
  const pending = app.start();
  const stopping = app.stop();
  settle();
  invariant(await pending === false, 'Cancelled start completed');
  await stopping;
  invariant(await app.restart() === true && starts === 1, 'Restart did not settle once');
  await app.destroy();
  invariant(app.isDestroyed() && child.isDestroyed(), 'Application ownership teardown failed');
  invariant(view.isDestroyed(), 'Application did not destroy its shown View');
  invariant(!region.isDestroyed() && !region.currentView, 'Borrowed Region lifetime changed');
  host.remove();
}

function stateCycle() {
  const source = keepInput(new Model({ value: 0 }));
  let calls = 0;
  const Owner = runtime.MnObject.extend({
    stateEvents: { 'change:value'() { calls++; } }
  });
  const first = track(new Owner({ state: source }));
  const second = track(new Owner({ state: source }));
  source.set('value', 1);
  invariant(calls === 2, 'Shared source did not notify both owners');
  first.destroy();
  source.set('value', 2);
  invariant(calls === 3, 'Independent state observer ownership failed');
  second.destroy();
  source.set('value', 3);
  invariant(calls === 3 && !source.isDestroyed(), 'Borrowed source cleanup failed');
  const Owned = Owner.extend({ createState() { return track(new Model({ value: 0 }), 'state'); } });
  const owned = track(new Owned());
  const state = owned.getState();
  owned.destroy();
  invariant(state.isDestroyed(), 'Factory state was not disposed');
}

export function holdControl() {
  control = new runtime.View();
  control.destroy();
  controlProbe = new WeakRef(control);
}
export function releaseControl() { control = null; }
export function controlAlive() { return Boolean(controlProbe.deref()); }

export async function runBatch(cycles) {
  invariant(probes.length === 0 && liveInputs.length === 0, 'Previous probes were not released');
  for (let index = 0; index < cycles; index++) {
    collectionCycle();
    replacementCycle();
    await applicationCycle();
    stateCycle();
  }
  return { cycles, tracked: probes.length, retainedInputs: liveInputs.length };
}

export function countAlive() {
  const counts = {};
  for (const { kind, ref } of probes) {
    if (ref.deref()) { counts[kind] = (counts[kind] || 0) + 1; }
  }
  return counts;
}
export function releaseInputs() {
  for (const input of liveInputs) { input.destroy(); }
  liveInputs.length = 0;
}
export function clearProbes() { probes.length = 0; }
