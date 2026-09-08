import { vi, describe, it, expect } from 'vitest';
import { setFixtures } from '../setup/fixtures.js';
import { configureStore } from '@reduxjs/toolkit';
import { CollectionView, View } from 'marionette';

// A consumer-owned integration, not a packaged Redux adapter. Model references
// are stable IDs; every read resolves the current immutable entity in the store.
function createIntegration() {
  const initial = {
    ids: [0, 1],
    entities: {
      0: { name: 'zero', rank: 2, visible: true },
      1: { name: 'one', rank: 1, visible: true }
    },
    unrelated: 0
  };
  const store = configureStore({
    reducer(state = initial, action) {
      return action.type === 'update' ? { ...state, ...action.payload } : state;
    }
  });
  const subscriptions = new Set();
  const models = vi.fn(() => store.getState().ids);

  function observe(selector, callback) {
    let previous = selector(store.getState());
    const stop = store.subscribe(() => {
      const current = selector(store.getState());
      if (current === previous) { return; }
      const before = previous;
      previous = current;
      callback(current, before);
    });
    subscriptions.add(stop);
    return () => {
      stop();
      subscriptions.delete(stop);
    };
  }

  const Data = {
    key(id) { return id; },
    get(id, attribute) { return store.getState().entities[id]?.[attribute]; },
    has(id, attribute) { return Object.hasOwn(store.getState().entities[id] || {}, attribute); },
    serialize(id) { return store.getState().entities[id]; },
    models,
    subscribe(id, eventName, callback, context) {
      expect(eventName).to.equal('change');
      return observe(state => state.entities[id], entity => callback.call(context, entity));
    },
    observeCollection(source, callback, context) {
      expect(source).to.equal(store);
      return observe(state => state.ids, (current, previous) => {
        const before = new Set(previous);
        const after = new Set(current);
        const added = current.filter(id => !before.has(id));
        const removed = previous.filter(id => !after.has(id));
        callback.call(context, added.length || removed.length ?
          { kind: 'update', added, removed, updated: [] } : { kind: 'reorder' });
      });
    }
  };

  return {
    Data, store, subscriptions,
    update(payload) { store.dispatch({ type: 'update', payload }); }
  };
}

describe('public DataApi with Redux stable model sources', function() {
  it('updates lists and a detail without replacing child Views, and releases subscriptions', function() {
    const { Data, store, subscriptions, update } = createIntegration();
    const Row = View.extend({
      template: data => data.name,
      modelEvents: { change: 'render' },
      initialize() { this.draft = 'local draft'; },
      attachElContent(name) {
        if (!this.el.firstChild) { this.el.innerHTML = '<span></span><input>'; }
        this.el.firstChild.textContent = name;
      },
      onRender() { this.renderCount = (this.renderCount || 0) + 1; }
    });
    Row.setDataApi(Data);
    const List = CollectionView.extend({ childView: Row });
    List.setDataApi(Data);
    const Detail = View.extend({
      template: data => data.name,
      modelEvents: { change: 'render' }
    });
    Detail.setDataApi(Data);
    const first = new List({ collection: store }).render();
    const second = new List({ collection: store }).render();
    const detail = new Detail({ model: 0 }).render();
    setFixtures(first.el, second.el, detail.el);
    const child = first.children.findByModel(0);
    const peer = second.children.findByModel(0);
    const input = child.el.querySelector('input');
    input.value = 'unsaved edit';
    input.focus();
    input.setSelectionRange(2, 5);
    expect(detail.el.textContent).to.equal('zero');
    expect(subscriptions.size).to.equal(7);
    Data.models.mockClear();

    update({ unrelated: 1 });
    expect(child.renderCount).to.equal(1);
    expect(peer.renderCount).to.equal(1);
    expect(Data.models).not.toHaveBeenCalled();

    const original = store.getState().entities[0];
    update({ entities: { ...store.getState().entities, 0: { ...original, name: 'edited' } } });
    expect(store.getState().entities[0]).not.to.equal(original);
    expect(first.children.findByModel(0)).to.equal(child);
    expect(second.children.findByModel(0)).to.equal(peer);
    expect(child.renderCount).to.equal(2);
    expect(peer.renderCount).to.equal(2);
    expect(child.el.firstChild.textContent).to.equal('edited');
    expect(detail.el.textContent).to.equal('edited');
    expect(child.draft).to.equal('local draft');
    expect(child.el.querySelector('input')).to.equal(input);
    expect(input.value).to.equal('unsaved edit');
    expect(document.activeElement).to.equal(input);
    expect([input.selectionStart, input.selectionEnd]).to.deep.equal([2, 5]);
    expect(Data.models).not.toHaveBeenCalled();

    update({
      ids: [0, 1, 2],
      entities: { ...store.getState().entities, 2: { name: 'two', rank: 3, visible: true } }
    });
    expect(first.children.pluck('model')).to.deep.equal([0, 1, 2]);
    expect(second.children.pluck('model')).to.deep.equal([0, 1, 2]);
    update({ ids: [2, 1, 0] });
    expect(first.children.pluck('model')).to.deep.equal([2, 1, 0]);
    expect(second.children.pluck('model')).to.deep.equal([2, 1, 0]);
    expect(first.el.lastChild).to.equal(child.el);
    expect(child.renderCount).to.equal(2);
    expect(child.el.querySelector('input')).to.equal(input);
    expect(document.activeElement).to.equal(input);
    const removed = first.children.findByModel(1);
    update({ ids: [2, 0] });
    expect(removed.isDestroyed()).to.equal(true);
    expect(first.children.pluck('model')).to.deep.equal([2, 0]);
    expect(second.children.pluck('model')).to.deep.equal([2, 0]);

    first.destroy();
    expect(subscriptions.size).to.equal(4);
    update({ entities: { ...store.getState().entities, 0: { name: 'still observed' } } });
    expect(peer.el.firstChild.textContent).to.equal('still observed');
    expect(detail.el.textContent).to.equal('still observed');
    expect(child.renderCount).to.equal(2);
    second.destroy();
    detail.destroy();
    expect(subscriptions.size).to.equal(0);
    update({ ids: [] });
    expect(peer.renderCount).to.equal(3);
  });
});

describe('falsy opaque DataApi sources', function() {
  it('serializes and observes falsy model and collection references', function() {
    for (const source of [0, false, '', 0n]) {
      const callbacks = [];
      const cleanup = vi.fn();
      const Data = {
        serialize: vi.fn(model => ({ name: String(model) })),
        models: vi.fn(() => [source]),
        subscribe(entity, name, callback, context) {
          expect(entity).to.equal(source);
          callbacks.push(() => callback.call(context));
          return cleanup;
        }
      };
      const Item = View.extend({
        template: data => data.name,
        modelEvents: { change: 'render' },
        collectionEvents: { change: 'render' }
      });
      Item.setDataApi(Data);
      const item = new Item({ model: source, collection: source }).render();
      expect(Data.serialize.mock.calls.map(args => args.slice(0, 1))).toContainEqual([source]);
      expect(item.el.textContent).to.equal(String(source));
      expect(callbacks).to.have.lengthOf(2);
      callbacks.forEach(notify => notify());
      expect(Data.serialize.mock.calls.length).to.equal(3);
      item.destroy();
      expect(cleanup.mock.calls.length).to.equal(2);

      const list = new Item({ collection: source, template: data => data.models[0].name }).render();
      expect(Data.models.mock.calls.map(args => args.slice(0, 1))).toContainEqual([source]);
      expect(list.el.textContent).to.equal(String(source));
      list.destroy();
    }
  });

  it('indexes, sorts, filters and removes falsy child models', function() {
    const models = [0, false, '', 0n];
    const records = new Map(models.map((model, index) => [model, { rank: 4 - index, visible: true }]));
    const Data = {
      key: model => model,
      models: () => models,
      serialize: model => records.get(model),
      get: (model, attribute) => records.get(model)[attribute],
      has: (model, attribute) => Object.hasOwn(records.get(model), attribute),
      observeCollection: () => () => {}
    };
    const Item = View.extend({ template: data => String(data.rank) });
    Item.setDataApi(Data);
    const List = CollectionView.extend({ childView: Item });
    List.setDataApi(Data);
    const list = new List({ collection: 0 }).render();
    expect(list.children.pluck('model')).to.deep.equal(models);
    list.setComparator('rank');
    list.setFilter('visible');
    expect(list.children.pluck('model')).to.deep.equal([...models].reverse());
    for (const model of models) {
      const child = list.children.findByModel(model);
      expect(child.model).to.equal(model);
      list.removeChildView(child);
      expect(list.children.findByModel(model)).to.equal(undefined);
    }
    expect(list.children).to.have.lengthOf(0);
    list.destroy();
  });
});
