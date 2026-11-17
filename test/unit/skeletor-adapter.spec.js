import { describe, it, expect, vi } from 'vitest';
import { Collection, Model } from '@converse/skeletor';
import { createMarionette } from 'marionette';
import SkeletorApi from '@mnjs/adapters/skeletor';

class Item extends Model {
  get computed() {
    return {
      label: { deps: ['title'], fn: model => `${model.get('title')}!` },
      empty: { deps: [], fn: () => null },
      unset: { deps: [], fn: () => undefined }
    };
  }
}

function runtime() {
  const mn = createMarionette();
  mn.setDataApi(SkeletorApi);
  mn.setStateApi(SkeletorApi);
  return mn;
}

function list(collection, options = {}) {
  const mn = runtime();
  const childView = mn.View.extend({
    template: ({ title }) => title,
    modelEvents: { change: 'render' }
  });
  return new mn.CollectionView({ collection, childView, ...options }).render();
}

describe('Skeletor adapter with real 4.0.2 sources', function() {
  it('reads own attributes and declared computed keys, including null and undefined', function() {
    const model = new Item({ title: 'First', nullable: null, undef: undefined });
    for (const [key, value] of Object.entries({ title: 'First', label: 'First!', nullable: null,
      undef: undefined, empty: null, unset: undefined })) {
      expect(SkeletorApi.has(model, key)).toBe(true);
      expect(SkeletorApi.get(model, key)).toBe(value);
    }
    for (const key of ['missing', 'toString', 'constructor']) {
      expect(SkeletorApi.has(model, key)).toBe(false);
      expect(SkeletorApi.get(model, key)).toBeUndefined();
    }
    expect(model.has('nullable')).toBe(false);
    expect(SkeletorApi.key(model)).toBe(model.cid);
  });

  it('keeps ordinary prototype-named attributes when computed properties exist', function() {
    const model = new Item({ title: 'First', toString: 'text', constructor: 'writer' });
    expect(SkeletorApi.get(model, 'toString')).toBe('text');
    expect(SkeletorApi.get(model, 'constructor')).toBe('writer');
    expect(SkeletorApi.serialize(model)).toMatchObject({ toString: 'text', constructor: 'writer', label: 'First!' });
  });

  it('provides an enumerable template snapshot without changing persisted attributes', function() {
    const model = new Item({ title: 'First', label: 'stored', undef: undefined });
    const data = SkeletorApi.serialize(model);
    expect(data).toEqual({ title: 'First', label: 'First!', undef: undefined, empty: null, unset: undefined });
    expect(Object.keys(data)).toEqual(['title', 'label', 'undef', 'empty', 'unset']);
    expect({ ...data }).toEqual(data);
    expect('unset' in data).toBe(true);
    expect(Object.hasOwn(data, 'unset')).toBe(true);
    expect(Object.entries(data)).toContainEqual(['label', 'First!']);
    expect(model.toJSON()).toEqual({ title: 'First', label: 'stored', undef: undefined });
    expect(Object.hasOwn(model.attributes, 'empty')).toBe(false);
    model.attrs.title = 'Second';
    expect(data.label).toBe('First!');
    expect(SkeletorApi.serialize(model).label).toBe('Second!');
    data.title = 'template only';
    expect(model.get('title')).toBe('Second');
  });

  it('serializes computed values for model and collection templates', function() {
    const mn = runtime();
    const model = new Item({ title: 'First' });
    const view = new mn.View({ model, template: data => ({ ...data }).label }).render();
    const collection = new Collection([model]);
    const collectionView = new mn.View({ collection,
      template: ({ models }) => models.map(({ label }) => label).join(',') }).render();
    expect(view.el.textContent).toBe('First!');
    expect(collectionView.el.textContent).toBe('First!');
    expect(SkeletorApi.models(collection)).toEqual([model]);
    expect(SkeletorApi.models(collection)).not.toBe(collection.models);
    view.destroy(); collectionView.destroy();
  });

  it('preserves event maps, space-separated names, payloads, and both context forms', function() {
    const model = new Model();
    const context = { owner: 'map' };
    const explicit = { owner: 'explicit' };
    const handler = vi.fn();
    const stop = SkeletorApi.subscribe(model, { 'one two': handler }, context);
    const stopExplicit = SkeletorApi.subscribe(model, { three: handler }, null, explicit);
    model.trigger('one', 1); model.trigger('two', 2); model.trigger('three', 3);
    expect(handler.mock.calls).toEqual([[1], [2], [3]]);
    expect(handler.mock.contexts).toEqual([context, context, explicit]);
    stop(); stop(); stopExplicit(); stopExplicit();
    model.trigger('one', 4); model.trigger('three', 5);
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it('releases only matching subscriptions and leaves caller listeners alive', function() {
    const model = new Model();
    const handler = vi.fn();
    const caller = { owner: 'caller' };
    const owner = { owner: 'view' };
    model.on('change', handler, caller);
    const stop = SkeletorApi.subscribe(model, 'change', handler, owner);
    model.set('title', 'one');
    stop(); stop();
    SkeletorApi.disposeOwned(model);
    model.set('title', 'two');
    expect(handler.mock.contexts).toEqual([caller, owner, caller]);
    model.off('change', handler, caller);
  });

  it('forwards attrs and computed model/state events with the owner context', function() {
    const mn = runtime();
    const model = new Item({ title: 'First' });
    const state = new Item({ title: 'Waiting' });
    const modelHandler = vi.fn();
    const stateHandler = vi.fn();
    const View = mn.View.extend({
      template: ({ label }) => label,
      modelEvents: { 'change:label': modelHandler, change: 'render' },
      stateEvents: { 'change:label': stateHandler }
    });
    const view = new View({ model, state }).render();
    model.attrs.title = 'Next';
    state.attrs.title = 'Ready';
    expect(view.el.textContent).toBe('Next!');
    expect(modelHandler.mock.calls[0].slice(0, 2)).toEqual([model, 'Next!']);
    expect(stateHandler.mock.calls[0].slice(0, 2)).toEqual([state, 'Ready!']);
    expect(modelHandler.mock.contexts).toEqual([view]);
    expect(stateHandler.mock.contexts).toEqual([view]);
    view.destroy(); view.destroy();
    model.attrs.title = 'After'; state.attrs.title = 'After';
    expect(modelHandler).toHaveBeenCalledTimes(1);
    expect(stateHandler).toHaveBeenCalledTimes(1);
  });

  it('does not destroy borrowed models or owned state or call persistence on teardown', function() {
    const mn = runtime();
    const state = new Model({ title: 'state' });
    const model = new Model({ title: 'model' });
    const destroyState = vi.spyOn(state, 'destroy');
    const destroyModel = vi.spyOn(model, 'destroy');
    const sync = vi.spyOn(state, 'sync');
    const caller = vi.fn();
    const owned = vi.fn();
    state.on('change', caller);
    const View = mn.View.extend({ template: false, createState() { return state; },
      stateEvents: { change: owned } });
    const view = new View({ model });
    view.getState();
    state.set('title', 'before');
    view.destroy(); view.destroy();
    state.set('title', 'after');
    expect(owned).toHaveBeenCalledTimes(1);
    expect(caller).toHaveBeenCalledTimes(2);
    expect(destroyState).not.toHaveBeenCalled();
    expect(destroyModel).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
  });

  it('updates an attached view when application-owned async fetch completes', async function() {
    const mn = runtime();
    let complete;
    class RemoteItem extends Item {
      sync(method, model, options) {
        expect(method).toBe('read');
        complete = () => options.success({ title: 'Hydrated' });
      }
    }
    const model = new RemoteItem({ id: 1, title: 'Loading' });
    const View = mn.View.extend({ template: ({ label }) => label, modelEvents: { change: 'render' } });
    const region = new mn.Region({ el: document.createElement('main') });
    document.body.append(region.el);
    const view = new View({ model });
    region.show(view);
    expect(view.el.textContent).toBe('Loading!');
    const fetched = model.fetch({ promise: true });
    await Promise.resolve();
    complete();
    await fetched;
    expect(view.el.textContent).toBe('Hydrated!');
    region.destroy(); region.el.remove();
    expect(model.toJSON()).toEqual({ id: 1, title: 'Hydrated' });
  });

  it('delivers one structural observation for each native operation', function() {
    const first = new Item({ id: 1, title: 'A', rank: 2 });
    const second = new Item({ id: 2, title: 'B', rank: 1 });
    const collection = new Collection([first], { comparator: 'rank' });
    const notify = vi.fn();
    const context = {};
    const stop = SkeletorApi.observeCollection(collection, notify, context);
    collection.add(second);
    expect(notify).toHaveBeenCalledExactlyOnceWith({ kind: 'update', added: [second], removed: [], updated: [] });
    notify.mockClear();
    collection.set([{ id: 1, rank: 0 }], { remove: false });
    expect(notify).toHaveBeenCalledExactlyOnceWith({ kind: 'update', added: [], removed: [], updated: [] });
    notify.mockClear();
    collection.remove(second);
    expect(notify).toHaveBeenCalledExactlyOnceWith({ kind: 'update', added: [], removed: [second], updated: [] });
    notify.mockClear();
    collection.reset([first, second]);
    expect(notify).toHaveBeenCalledExactlyOnceWith({ kind: 'reset' });
    notify.mockClear();
    collection.sort();
    expect(notify).toHaveBeenCalledExactlyOnceWith({ kind: 'reorder' });
    expect(notify.mock.contexts).toEqual([context]);
    notify.mockClear();
    collection.trigger('sort', collection);
    expect(notify).toHaveBeenCalledExactlyOnceWith({ kind: 'reorder' });
    stop(); stop();
    collection.reset([]);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('retains child identity and renders merged models once through model events', function() {
    const collection = new Collection([{ id: 1, title: 'A', rank: 1 }, { id: 2, title: 'B', rank: 2 }],
      { comparator: 'rank' });
    const renders = vi.fn();
    const view = list(collection, { childView: runtime().View.extend({
      template: ({ title }) => title, modelEvents: { change: 'render' }, onRender: renders
    }) });
    const first = view.children.findByModel(collection.get(1));
    const second = view.children.findByModel(collection.get(2));
    const secondNode = second.el.firstChild;
    renders.mockClear();
    collection.set([{ id: 1, title: 'Next', rank: 3 }], { remove: false });
    expect(view.el.textContent).toBe('BNext');
    expect(view.children.findByModel(collection.get(1))).toBe(first);
    expect(view.children.findByModel(collection.get(2))).toBe(second);
    expect(second.el.firstChild).toBe(secondNode);
    expect(renders).toHaveBeenCalledTimes(1);
    collection.set([{ id: 1, title: 'Final' }, { id: 3, title: 'C', rank: 0 }]);
    expect(view.el.textContent).toBe('CFinal');
    expect(second.isDestroyed()).toBe(true);
    expect(view.children.findByModel(collection.get(1))).toBe(first);
    view.destroy();
  });

  it('handles reorder-only set with model instances and merge:false attribute objects', function() {
    const collection = new Collection([{ id: 1, title: 'A' }, { id: 2, title: 'B' }]);
    const view = list(collection);
    const first = collection.get(1);
    const second = collection.get(2);
    const children = view.children.toArray();
    collection.set([second, first]);
    expect(view.el.textContent).toBe('BA');
    collection.set([{ id: 1 }, { id: 2 }], { merge: false });
    expect(view.el.textContent).toBe('AB');
    expect(view.children.findByModel(first)).toBe(children[0]);
    expect(view.children.findByModel(second)).toBe(children[1]);
    view.destroy();
  });

  it('reconciles reset, standalone sort, add/remove, filtering and teardown', function() {
    const collection = new Collection([{ id: 1, title: 'A', rank: 2, visible: true }], { comparator: 'rank' });
    const view = list(collection, { viewFilter: child => child.model.get('visible') });
    const first = view.children.findByIndex(0);
    const second = collection.add({ id: 2, title: 'B', rank: 1, visible: true });
    expect(view.el.textContent).toBe('BA');
    collection.set([{ id: 1, visible: false }], { remove: false });
    expect(view.el.textContent).toBe('B');
    second.set('rank', 4); collection.sort();
    expect(first.isDestroyed()).toBe(false);
    collection.set([{ id: 1, visible: true }], { remove: false });
    expect(view.children.findByModel(collection.get(1))).toBe(first);
    collection.set([{ id: 1, visible: false }], { remove: false });
    collection.remove(second);
    expect(view.el.textContent).toBe('');
    collection.reset([{ id: 3, title: 'C', rank: 1, visible: true }]);
    expect(view.el.textContent).toBe('C');
    expect(first.isDestroyed()).toBe(true);
    view.destroy(); view.destroy();
    collection.add({ id: 4, title: 'D' });
    expect(view.children.length).toBe(0);
  });

  it('reconciles set operations with sortWithCollection disabled', function() {
    const collection = new Collection([{ id: 1, title: 'A' }, { id: 2, title: 'B' }]);
    const view = list(collection, { sortWithCollection: false });
    const first = view.children.findByIndex(0);
    collection.set([collection.get(2), collection.get(1)]);
    expect(view.el.textContent).toBe('AB');
    expect(first.isDestroyed()).toBe(false);
    collection.add({ id: 3, title: 'C' });
    expect(view.el.textContent).toBe('ABC');
    view.destroy();
  });

  it('keeps independent observers subscribed when one is released', function() {
    const collection = new Collection();
    const caller = vi.fn();
    collection.on('update', caller);
    const first = vi.fn(); const second = vi.fn();
    const stopFirst = SkeletorApi.observeCollection(collection, first);
    const stopSecond = SkeletorApi.observeCollection(collection, second);
    stopFirst(); stopFirst();
    collection.add({ id: 1 });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(caller).toHaveBeenCalledTimes(1);
    stopSecond();
  });

  it('does not configure other runtimes when imported or installed', function() {
    const first = runtime();
    const second = createMarionette();
    const model = new Model();
    expect(first.View.prototype.Data.key(model)).toBe(model.cid);
    expect(second.View.prototype.Data.key(model)).toBe(model);
  });
});
