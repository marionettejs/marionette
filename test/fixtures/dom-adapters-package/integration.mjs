import assert from 'node:assert/strict';
import { html, nothing, render } from 'lit-html';
import { AsyncDirective } from 'lit-html/async-directive.js';
import { directive } from 'lit-html/directive.js';

export function verifyLitIntegration({ View, Region, CollectionView }, { Model, Collection, DataApi, StateApi }, LitDomApi) {
  const connected = new Set();
  class Subscription extends AsyncDirective {
    render(value) {
      if (this.isConnected) { connected.add(this); }
      return value;
    }
    reconnected() { connected.add(this); }
    disconnected() { connected.delete(this); }
  }
  const subscription = directive(Subscription);

  // The host belongs to an external Lit renderer; only its child is Marionette-owned.
  const host = document.createElement('main');
  document.body.append(host);
  const renderHost = title => render(html`<header>${subscription(title)}</header><section class="managed"></section>`, host);
  renderHost('External host');
  const slot = host.querySelector('.managed');
  const childRegion = new Region({ el: slot });
  let clicks = 0;
  const Panel = View.extend({
    template: () => html`<button>${subscription('Managed child')}</button>`,
    events: { 'click button': () => clicks++ },
  }).setDomApi(LitDomApi);
  const child = new Panel();
  childRegion.show(child);
  const childRoot = child.el;
  const button = childRoot.querySelector('button');
  assert.equal(connected.size, 2);
  renderHost('Updated external host');
  assert.equal(host.querySelector('.managed'), slot);
  assert.equal(slot.firstElementChild, childRoot);
  assert.equal(childRoot.querySelector('button'), button);
  button.click();
  assert.equal(clicks, 1);
  assert.equal(childRegion.detachView(), child);
  assert.equal(connected.size, 1, 'Child detach must preserve the external host subscription');
  renderHost('Host survives child detachment');
  childRegion.show(child);
  assert.equal(connected.size, 2);
  assert.equal(childRoot.querySelector('button'), button);
  childRegion.empty();
  assert.equal(child.isDestroyed(), true);
  button.click();
  assert.equal(clicks, 1, 'Destroyed child must release DOM handlers');
  assert.equal(connected.size, 1);
  childRegion.show(new Panel());
  assert.equal(connected.size, 2);
  childRegion.destroy();
  assert.equal(connected.size, 1, 'Region destruction must leave the external host active');
  assert.equal(host.querySelector('header').textContent, 'Host survives child detachment');
  render(nothing, host);
  assert.equal(connected.size, 0, 'The external renderer owns its own final cleanup');
  host.remove();

  // Count real provider subscriptions at their public acquisition/cleanup boundary.
  const active = new Set();
  function track(kind, source, cleanup) {
    const entry = { kind, source };
    active.add(entry);
    return () => {
      active.delete(entry);
      cleanup();
    };
  }
  const observedData = {
    ...DataApi,
    subscribe(source, ...args) { return track('entity', source, DataApi.subscribe(source, ...args)); },
    observeCollection(source, ...args) { return track('structure', source, DataApi.observeCollection(source, ...args)); },
  };
  const observedState = {
    ...StateApi,
    subscribe(source, ...args) { return track('state', source, StateApi.subscribe(source, ...args)); },
  };
  const state = new Model({ tick: 0 });
  const heading = new Model({ title: 'Items' });
  const first = new Model({ id: 'a', label: 'Alpha' });
  const second = new Model({ id: 'b', label: 'Beta' });
  const third = new Model({ id: 'c', label: 'Gamma' });
  const fourth = new Model({ id: 'd', label: 'Delta' });
  const collection = new Collection([first, second]);
  const deliveries = { state: 0, collection: 0, heading: 0, rows: 0 };
  const Row = View.extend({
    tagName: 'li',
    template: ({ label }) => html`${subscription(label)}`,
    modelEvents: { 'change:label': 'render' },
    stateEvents: { 'change:tick': () => deliveries.state++ },
    onRender() { deliveries.rows++; },
  }).setDataApi(observedData).setStateApi(observedState).setDomApi(LitDomApi);
  const List = CollectionView.extend({
    template: () => html`<header>${subscription('List')}</header><ul class="rows"></ul>`,
    childViewContainer: '.rows',
    childView: Row,
    childViewOptions: { state },
    modelEvents: { 'change:title': () => deliveries.heading++ },
    collectionEvents: { update: () => deliveries.collection++ },
    stateEvents: { 'change:tick': () => deliveries.state++ },
  }).setDataApi(observedData).setStateApi(observedState).setDomApi(LitDomApi);
  const mount = document.createElement('main');
  document.body.append(mount);
  const listRegion = new Region({ el: mount });
  const list = new List({ model: heading, collection, state });
  function verifySubscriptions(models) {
    assert.deepEqual(list.children.toArray().map(view => view.model), models);
    const counts = { structure: 0, entity: 0, state: 0 };
    for (const entry of active) { counts[entry.kind]++; }
    assert.deepEqual(counts, { structure: 1, entity: 2 + models.length, state: 1 + models.length });
    assert.equal(connected.size, 1 + models.length);
    assert.equal([...active].filter(entry => entry.source === collection).length, 2);
  }
  listRegion.show(list);
  verifySubscriptions([first, second]);
  const firstView = list.children.findByModel(first);
  const secondView = list.children.findByModel(second);
  const listHeader = list.el.querySelector('header');
  state.set('tick', 1);
  assert.equal(deliveries.state, 3);
  collection.add(third);
  verifySubscriptions([first, second, third]);
  assert.equal(list.children.findByModel(first), firstView);
  assert.equal(list.children.findByModel(second), secondView);
  collection.remove(second);
  verifySubscriptions([first, third]);
  assert.equal(secondView.isDestroyed(), true);
  let renders = deliveries.rows;
  second.set('label', 'Removed');
  assert.equal(deliveries.rows, renders);
  const oldThirdView = list.children.findByModel(third);
  collection.reset([third, fourth]);
  verifySubscriptions([third, fourth]);
  assert.equal(firstView.isDestroyed(), true);
  assert.equal(oldThirdView.isDestroyed(), true);
  assert.notEqual(list.children.findByModel(third), oldThirdView);
  assert.equal(list.el.querySelector('header'), listHeader, 'Collection reset must retain the list template');
  renders = deliveries.rows;
  third.set('label', 'Updated Gamma');
  assert.equal(deliveries.rows, renders + 1, 'Only the replacement row may observe the retained Model');
  state.set('tick', 2);
  assert.equal(deliveries.state, 6, 'Reset must release old row state subscriptions');
  listRegion.detachView();
  assert.equal(connected.size, 0);
  assert.equal(active.size, 8, 'Detached Views retain data and state observation');
  listRegion.show(list);
  verifySubscriptions([third, fourth]);
  let externalUpdates = 0;
  collection.on('update', () => externalUpdates++);
  listRegion.destroy();
  assert.equal(active.size, 0);
  assert.equal(connected.size, 0);
  assert.equal(state.isDestroyed(), false);
  assert.equal(collection.isDestroyed(), false);
  const ended = { ...deliveries };
  state.set('tick', 3);
  heading.set('title', 'After teardown');
  third.set('label', 'After teardown');
  collection.add({ id: 'e', label: 'After teardown' });
  assert.deepEqual(deliveries, ended);
  assert.equal(externalUpdates, 1, 'Cleanup must preserve other consumers');
  collection.destroy();
  [state, heading, first, second, third, fourth].forEach(source => source.destroy());
  mount.remove();
}
