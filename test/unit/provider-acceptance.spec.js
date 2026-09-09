import { describe, it, expect } from 'vitest';
import { createMarionette } from 'marionette';
import { Collection, DataApi } from '@mnjs/data';
import Backbone from 'backbone';
import BackboneApi from '@mnjs/adapters/backbone';
import createXStateActorApi from '@mnjs/adapters/xstate';
import { assign, createActor, createMachine } from 'xstate';

// Each fixture supplies native mutations and its own notification vocabulary.
// The shared assertion concerns consumers, not equivalence of provider events.
function mutableModels(CollectionClass, api) {
  const collection = new CollectionClass([{ id: 1, label: 'one' }, { id: 2, label: 'two' }]);
  const first = collection.at(0);
  const second = collection.at(1);
  return {
    api, collection, first, second, event: 'change',
    reorder() {
      if (collection instanceof Collection) { collection.move(second, 0); } else {
        collection.comparator = model => -model.id;
        collection.sort();
      }
    },
    rename(label) { first.set('label', label); },
    remove() { collection.remove(second); },
    verifySource() { expect(first.get('label')).toBe('latest'); },
    dispose() { if (collection instanceof Collection) { collection.destroy(); } }
  };
}

function actorModels() {
  const childMachine = createMachine({
    context: ({ input }) => input,
    on: { rename: { actions: assign({ label: ({ event }) => event.label }) } }
  });
  const first = createActor(childMachine, { input: { id: 1, label: 'one' } }).start();
  const second = createActor(childMachine, { input: { id: 2, label: 'two' } }).start();
  const collection = createActor(createMachine({
    context: { models: [first, second] },
    on: { replace: { actions: assign({ models: ({ event }) => event.models }) } }
  })).start();
  return {
    api: createXStateActorApi({ select: snapshot => snapshot.context.models, snapshotEvent: 'snapshot' }),
    collection, first, second, event: 'snapshot',
    reorder() { collection.send({ type: 'replace', models: [second, first] }); },
    rename(label) { first.send({ type: 'rename', label }); },
    remove() { collection.send({ type: 'replace', models: [first] }); },
    verifySource() {
      expect(first.getSnapshot().context.label).toBe('latest');
      expect(first.getSnapshot().status).toBe('active');
      expect(collection.getSnapshot().status).toBe('active');
    },
    dispose() { collection.stop(); first.stop(); second.stop(); }
  };
}

function sharedConsumers(provider) {
  const runtime = createMarionette();
  runtime.setDataApi(provider.api);
  const renders = new Map();
  const Child = runtime.View.extend({
    template: data => `<input><span>${data.label}</span>`,
    modelEvents: { [provider.event]: 'render' },
    onRender() { renders.set(this, (renders.get(this) || 0) + 1); }
  });
  const List = runtime.CollectionView.extend({ childView: Child });
  const firstList = new List({ collection: provider.collection }).render();
  const secondList = new List({ collection: provider.collection }).render();
  const detail = new Child({ model: provider.first }).render();
  try {
    const removedConsumer = firstList.children.findByModel(provider.first);
    const survivor = secondList.children.findByModel(provider.first);
    const removedModelView = secondList.children.findByModel(provider.second);
    const input = survivor.el.querySelector('input');
    input.value = 'unfinished draft';
    provider.reorder();
    expect(secondList.children.toArray().map(child => child.model)).toEqual([provider.second, provider.first]);
    expect(secondList.children.findByModel(provider.first)).toBe(survivor);
    expect(survivor.el.querySelector('input')).toBe(input);
    expect(input.value).toBe('unfinished draft');
    firstList.destroy();
    const removedRenderCount = renders.get(removedConsumer);
    provider.rename('updated');
    expect(renders.get(removedConsumer)).toBe(removedRenderCount);
    expect(detail.el.textContent).toBe('updated');
    expect(survivor.el.textContent).toBe('updated');
    detail.destroy();
    const detailRenderCount = renders.get(detail);
    provider.remove();
    provider.rename('latest');
    expect(removedModelView.isDestroyed()).toBe(true);
    expect(secondList.children.toArray()).toEqual([survivor]);
    expect(survivor.el.textContent).toBe('latest');
    expect(renders.get(detail)).toBe(detailRenderCount);
    secondList.destroy();
    provider.verifySource();
  } finally {
    firstList.destroy();
    secondList.destroy();
    detail.destroy();
    provider.dispose();
  }
}

describe('provider acceptance through shared consumers', () => {
  it('preserves native data survivors and releases only the destroyed consumers', () => {
    sharedConsumers(mutableModels(Collection, DataApi));
  });

  it('preserves Backbone survivors and releases only the destroyed consumers', () => {
    sharedConsumers(mutableModels(Backbone.Collection, BackboneApi));
  });

  it('preserves actor survivors and releases only the destroyed consumers', () => {
    sharedConsumers(actorModels());
  });

  it('keeps shared static sources borrowed and refreshes only explicitly rendered consumers', () => {
    const runtime = createMarionette();
    const models = [{ label: 'one' }];
    const Child = runtime.View.extend({ template: model => model.label });
    const List = runtime.CollectionView.extend({ childView: Child });
    const first = new List({ collection: models }).render();
    const second = new List({ collection: models }).render();
    try {
      first.destroy();
      models[0].label = 'updated';
      models.push({ label: 'two' });
      expect(second.el.textContent).toBe('one');
      second.render();
      expect(second.el.textContent).toBe('updatedtwo');
      expect(second.children.toArray().map(child => child.model)).toEqual(models);
      second.destroy();
      expect(models).toEqual([{ label: 'updated' }, { label: 'two' }]);
    } finally {
      first.destroy();
      second.destroy();
    }
  });
});
