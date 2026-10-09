import { expect, it, vi } from 'vitest';
import { Behavior, CollectionView, View } from 'marionette';
import { Events } from '@mnjs/utils';

function source() { return Object.assign({}, Events); }

for (const Host of [View, CollectionView]) {
  it(`replaces fresh entity handlers on repeated ${Host === View ? 'View' : 'CollectionView'} delegation`, () => {
    const model = source();
    const collection = source();
    const delivered = vi.fn();
    const Custom = Host.extend({
      modelEvents() { return { change: value => delivered('model', value) }; },
      collectionEvents() { return { update: value => delivered('collection', value) }; },
    });
    const view = new Custom({ model, collection });

    try {
      expect(view.delegateEntityEvents()).toBe(view);
      expect(view.delegateEntityEvents()).toBe(view);
      model.trigger('change', 'ready');
      collection.trigger('update', 'ready');
      expect(delivered.mock.calls).toEqual([['model', 'ready'], ['collection', 'ready']]);
      view.destroy();
      model.trigger('change', 'late');
      collection.trigger('update', 'late');
      expect(delivered).toHaveBeenCalledTimes(2);
    } finally {
      view.destroy();
      model.off();
      collection.off();
    }
  });
}

it('releases old sources and removed declarations when rebinding', () => {
  const oldModel = source();
  const oldCollection = source();
  const nextModel = source();
  const delivered = vi.fn();
  const view = new View({ model: oldModel, collection: oldCollection, modelEvents: { change: delivered }, collectionEvents: { update: delivered } });

  try {
    view.model = nextModel;
    view.collection = undefined;
    view.delegateEntityEvents();
    oldModel.trigger('change', 'old model');
    oldCollection.trigger('update', 'old collection');
    nextModel.trigger('change', 'new model');
    expect(delivered).toHaveBeenCalledExactlyOnceWith('new model');

    view.modelEvents = undefined;
    view.delegateEntityEvents();
    nextModel.trigger('change', 'removed declaration');
    expect(delivered).toHaveBeenCalledTimes(1);
  } finally {
    view.destroy();
    oldModel.off();
    oldCollection.off();
    nextModel.off();
  }
});

it('replaces Behavior handlers through host and direct delegation', () => {
  const model = source();
  const collection = source();
  const delivered = vi.fn();
  let behavior;
  const ListeningBehavior = Behavior.extend({
    initialize() { behavior = this; },
    modelEvents() { return { change: () => delivered('model') }; },
    collectionEvents() { return { update: () => delivered('collection') }; },
  });
  const view = new View({ model, collection, behaviors: [ListeningBehavior] });

  try {
    view.delegateEntityEvents();
    expect(behavior.delegateEntityEvents()).toBe(behavior);
    model.trigger('change');
    collection.trigger('update');
    expect(delivered.mock.calls).toEqual([['model'], ['collection']]);
    view.destroy();
    model.trigger('change');
    collection.trigger('update');
    expect(delivered).toHaveBeenCalledTimes(2);
  } finally {
    view.destroy();
    model.off();
    collection.off();
  }
});
