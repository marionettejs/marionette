import { vi, describe, it, expect } from 'vitest';
import '../../setup/backbone.js';
import Backbone from 'backbone';
import BackboneApi from '@marionette/adapters/backbone';
import { View } from 'marionette';
import { CollectionView } from 'marionette';

describe('BackboneApi', function() {
  it('maps Backbone model and collection data', function() {
    const model = new Backbone.Model({ present: undefined, title: 'one' });
    const collection = new Backbone.Collection([model]);

    expect(BackboneApi.key(model)).to.equal(model.cid);
    expect(BackboneApi.get(model, 'title')).to.equal('one');
    expect(BackboneApi.get(model, 'constructor')).toBeUndefined();
    expect(BackboneApi.has(model, 'constructor')).toBe(false);
    model.set('constructor', 'value');
    expect(BackboneApi.get(model, 'constructor')).to.equal('value');
    expect(BackboneApi.has(model, 'constructor')).toBe(true);
    expect(BackboneApi.has(model, 'present')).toBe(true);
    expect(BackboneApi.has(model, 'missing')).toBe(false);
    expect(BackboneApi.serialize(model)).to.equal(model.attributes);
    const models = BackboneApi.models(collection);
    expect(models).to.deep.equal(collection.models);
    expect(models).to.not.equal(collection.models);
    models.length = 0;
    expect(BackboneApi.models(collection)).to.deep.equal([model]);
    expect(BackboneApi.items).toBeUndefined();
  });

  it('subscribes with context and returns an idempotent cleanup function', function() {
    const model = new Backbone.Model();
    const context = {};
    const callback = vi.fn();
    const off = vi.spyOn(model, 'off');
    const cleanup = BackboneApi.subscribe(model, 'change', callback, context);

    model.trigger('change', model);
    cleanup();
    cleanup();
    model.trigger('change', model);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.contexts).toContain(context);
    expect(callback.mock.calls.map(args => args.slice(0, 1))).toContainEqual([model]);
    expect(off).toHaveBeenCalledTimes(1);
    expect(off.mock.calls.map(args => args.slice(0, 3))).toContainEqual(['change', callback, context]);
  });

  it('leaves owned Backbone state source lifecycle to the caller', function() {
    const model = new Backbone.Model();
    const destroy = vi.spyOn(model, 'destroy');
    const stopListening = vi.spyOn(model, 'stopListening');
    const off = vi.spyOn(model, 'off');

    BackboneApi.disposeOwned(model);

    expect(stopListening).not.toHaveBeenCalled();
    expect(off).not.toHaveBeenCalled();
    expect(destroy).not.toHaveBeenCalled();
  });

  it('normalizes structural collection events and disposes them', function() {
    const collection = new Backbone.Collection();
    const callback = vi.fn();
    const added = new Backbone.Model();
    const removed = new Backbone.Model();
    const updated = new Backbone.Model();
    const cleanup = BackboneApi.observeCollection(collection, callback);

    collection.trigger('sort', collection);
    collection.trigger('sort', collection, { add: true });
    collection.trigger('sort', collection, { merge: true });
    collection.trigger('sort', collection, { remove: true });
    collection.trigger('sort', collection);
    collection.trigger('reset', collection, {});
    collection.trigger('update', collection, {
      changes: { added: [added], removed: [removed], merged: [updated] }
    });

    expect(callback).toHaveBeenCalledTimes(4);
    expect(callback.mock.calls.at(0)).toEqual([{ kind: 'reorder' }]);
    expect(callback.mock.calls.at(1)).toEqual([{ kind: 'reorder' }]);
    expect(callback.mock.calls[2]).toEqual([{ kind: 'reset' }]);
    expect(callback.mock.calls.at(-1)).toEqual([{
      kind: 'update',
      added: [added],
      removed: [removed],
      updated: []
    }]);

    cleanup();
    collection.trigger('reset', collection, {});
    expect(callback).toHaveBeenCalledTimes(4);
  });

  it('retains the v4 notification boundary for a reorder-only set', function() {
    const first = new Backbone.Model({ id: 1 });
    const second = new Backbone.Model({ id: 2 });
    const collection = new Backbone.Collection([first, second]);
    const callback = vi.fn();
    const cleanup = BackboneApi.observeCollection(collection, callback);
    const Child = View.extend({ template: ({ id }) => String(id) });
    Child.setDataApi(BackboneApi);
    const List = CollectionView.extend({ childView: Child });
    List.setDataApi(BackboneApi);
    const view = new List({ collection }).render();

    collection.set([second, first]);

    expect(collection.models).to.deep.equal([second, first]);
    expect(callback).not.toHaveBeenCalled();
    expect(view.el.textContent).to.equal('12');
    view.render();
    expect(view.el.textContent).to.equal('21');
    view.destroy();
    cleanup();
  });

  it('reports sorted additions and merges once, while preserving explicit sorts', function() {
    const collection = new Backbone.Collection([{ id: 1, rank: 1 }, { id: 2, rank: 2 }], {
      comparator: 'rank'
    });
    const callback = vi.fn();
    const cleanup = BackboneApi.observeCollection(collection, callback);

    collection.add({ id: 3, rank: 0 });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls.at(0)[0].kind).to.equal('update');
    expect(callback.mock.calls.at(0)[0].added).to.deep.equal([collection.get(3)]);

    collection.set([{ id: 1, rank: -1 }], { remove: false });
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback.mock.calls.at(1)[0]).to.deep.equal({
      kind: 'update', added: [], removed: [],
      updated: []
    });
    expect(collection.pluck('id')).to.deep.equal([1, 3, 2]);

    collection.sort();
    expect(callback).toHaveBeenCalledTimes(3);
    expect(callback.mock.calls[2][0]).to.deep.equal({ kind: 'reorder' });
    cleanup();
  });

});
