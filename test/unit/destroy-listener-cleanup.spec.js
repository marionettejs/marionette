import { describe, expect, it, vi } from 'vitest';
import { Application, Behavior, CollectionView, MnObject, Region, View } from 'marionette';
import { Collection, Model } from '@mnjs/data';
import { Events } from '@mnjs/utils';

const owners = [
  ['MnObject', () => new MnObject()],
  ['View', () => new View()],
  ['CollectionView', () => new CollectionView()],
  ['Region', () => new Region({ el: document.createElement('div') })],
  ['Application', () => new Application()],
];

describe('Destroyed event sources release their observers', function() {
  it.each([...owners, ['Model', () => new Model()], ['Collection', () => new Collection()]])(
    '%s releases incoming subscriptions after delivering destroy', async function(name, create) {
      const source = create();
      const living = new MnObject();
      const listener = new MnObject();
      const intent = vi.fn();
      const pendingOnce = vi.fn();
      const stillListening = vi.fn();
      const order = [];
      source.on('destroy', () => order.push('direct'));
      listener.listenTo(source, {
        intent,
        destroy: () => {
          expect(source.isDestroyed()).toBe(true);
          order.push('listener');
        },
      });
      listener.listenToOnce(source, 'later', pendingOnce);
      listener.listenTo(living, 'intent', stillListening);

      await source.destroy();

      expect(order).toEqual(['direct', 'listener']);
      expect(Object.keys(listener._rdListeningTo)).toEqual([living._rdListenId]);
      expect(Object.keys(source._rdListeners)).toEqual([]);
      source.trigger('intent');
      source.trigger('later');
      source.trigger('destroy');
      living.trigger('intent');
      expect(intent).not.toHaveBeenCalled();
      expect(pendingOnce).not.toHaveBeenCalled();
      expect(order).toEqual(['direct', 'listener']);
      expect(stillListening).toHaveBeenCalledTimes(1);
      listener.destroy();
      living.destroy();
    }
  );

  it.each(owners)('%s releases subscriptions if its final destroy hook throws', async function(name, create) {
    const source = create();
    const listener = new MnObject();
    const observed = new MnObject();
    const incoming = vi.fn();
    const outgoing = vi.fn();
    const failure = new Error('destroy notification failed');
    listener.listenTo(source, 'intent', incoming);
    source.listenTo(observed, 'change', outgoing);
    source.onDestroy = () => { throw failure; };

    await expect(Promise.resolve().then(() => source.destroy())).rejects.toBe(failure);

    expect(source.isDestroyed()).toBe(true);
    expect(Object.keys(listener._rdListeningTo)).toEqual([]);
    expect(Object.keys(source._rdListeningTo)).toEqual([]);
    source.trigger('intent');
    observed.trigger('change');
    expect(incoming).not.toHaveBeenCalled();
    expect(outgoing).not.toHaveBeenCalled();
    listener.destroy();
    observed.destroy();
  });

  it('keeps Application observers across stop and restart until destruction', async function() {
    const app = new Application();
    const listener = new MnObject();
    const started = vi.fn();
    listener.listenTo(app, 'start', started);

    await app.start();
    await app.stop();
    expect(Object.keys(listener._rdListeningTo)).toEqual([app._rdListenId]);
    await app.start();
    expect(started).toHaveBeenCalledTimes(2);

    await app.destroy();
    expect(Object.keys(listener._rdListeningTo)).toEqual([]);
    listener.destroy();
  });

  it('replaces views without accumulating references in the retained Application', async function() {
    const app = new Application();
    const region = new Region({ el: document.createElement('div') });
    const intent = vi.fn();
    for (let index = 0; index < 5; index++) {
      const previous = region.currentView;
      const view = new View({ template: false });
      region.show(view);
      app.listenTo(view, { intent });
      expect(Object.keys(app._rdListeningTo)).toEqual([view._rdListenId]);
      previous?.trigger('intent');
    }

    region.empty();
    expect(Object.keys(app._rdListeningTo)).toEqual([]);
    expect(intent).not.toHaveBeenCalled();
    region.destroy();
    await app.destroy();
  });

  it('releases an independently destroyed Behavior without inventing a destroy event', function() {
    const view = new View();
    const behavior = new Behavior({}, view);
    const listener = new MnObject();
    const destroy = vi.fn();
    listener.listenTo(behavior, 'destroy', destroy);

    behavior.destroy();

    expect(Object.keys(listener._rdListeningTo)).toEqual([]);
    expect(destroy).not.toHaveBeenCalled();
    listener.destroy();
    view.destroy();
  });

  it.each([['View', View], ['CollectionView', CollectionView]])(
    '%s delivers its destroy event to Behavior observers before releasing them', function(name, Host) {
      let behavior;
      const TestBehavior = Behavior.extend({ initialize() { behavior = this; } });
      const view = new Host({ behaviors: [TestBehavior] });
      const listener = new MnObject();
      const destroy = vi.fn();
      listener.listenTo(behavior, 'destroy', destroy);

      view.destroy();

      expect(destroy).toHaveBeenCalledTimes(1);
      expect(destroy.mock.calls[0][0]).toBe(view);
      expect(Object.keys(listener._rdListeningTo)).toEqual([]);
      listener.destroy();
    }
  );

  it.each([['View', View], ['CollectionView', CollectionView]])(
    '%s immediately releases a Behavior destroyed during before:destroy', function(name, Host) {
      let behavior;
      const TestBehavior = Behavior.extend({ initialize() { behavior = this; } });
      const view = new Host({ behaviors: [TestBehavior] });
      const listener = new MnObject();
      const intent = vi.fn();
      listener.listenTo(behavior, 'intent', intent);
      view.onBeforeDestroy = () => {
        expect(view.isDestroyed()).toBe(false);
        behavior.destroy();
        expect(view._behaviors).toEqual([]);
        expect(Object.keys(listener._rdListeningTo)).toEqual([]);
        behavior.trigger('intent');
        expect(intent).not.toHaveBeenCalled();
      };

      view.destroy();

      expect(Object.keys(listener._rdListeningTo)).toEqual([]);
      listener.destroy();
    }
  );

  it.each([
    ['View', 'host', View],
    ['View', 'behavior', View],
    ['CollectionView', 'host', CollectionView],
    ['CollectionView', 'behavior', CollectionView],
  ])('%s releases all Behavior observers when the %s destroy hook throws', function(name, hookOwner, Host) {
    const behaviors = [];
    const TestBehavior = Behavior.extend({ initialize() { behaviors.push(this); } });
    const view = new Host({ behaviors: [TestBehavior, TestBehavior] });
    const listener = new MnObject();
    const intent = vi.fn();
    const failure = new Error('destroy notification failed');
    listener.listenTo(view, 'intent', intent);
    behaviors.forEach(behavior => listener.listenTo(behavior, 'intent', intent));
    const throwingOwner = hookOwner === 'host' ? view : behaviors[0];
    throwingOwner.onDestroy = () => { throw failure; };

    expect(() => view.destroy()).toThrow(failure);

    expect(view.isDestroyed()).toBe(true);
    expect(Object.keys(listener._rdListeningTo)).toEqual([]);
    expect(Object.keys(view._rdListeners)).toEqual([]);
    view.trigger('intent');
    behaviors.forEach(behavior => {
      expect(Object.keys(behavior._rdListeners)).toEqual([]);
      behavior.trigger('intent');
    });
    expect(intent).not.toHaveBeenCalled();
    listener.destroy();
  });

  it('does not treat a generic destroy event as object destruction', function() {
    const source = Object.assign({}, Events);
    const listener = new MnObject();
    const event = vi.fn();
    listener.listenTo(source, { destroy: event, change: event });

    source.trigger('destroy');
    source.trigger('change');

    expect(event).toHaveBeenCalledTimes(2);
    expect(Object.keys(listener._rdListeningTo)).toEqual([source._rdListenId]);
    listener.destroy();
  });

  it('keeps Collection subscriptions when it forwards a Model destroy event', function() {
    const model = new Model({ id: 1 });
    const collection = new Collection([model]);
    const listener = new MnObject();
    const forwarded = vi.fn();
    const added = vi.fn();
    listener.listenTo(collection, { destroy: forwarded, add: added });

    model.destroy();
    collection.add({ id: 2 });

    expect(forwarded).toHaveBeenCalledTimes(1);
    expect(forwarded.mock.calls[0][0]).toBe(model);
    expect(collection.isDestroyed()).toBe(false);
    expect(added).toHaveBeenCalledTimes(1);
    expect(Object.keys(listener._rdListeningTo)).toEqual([collection._rdListenId]);
    collection.destroy();
    expect(Object.keys(listener._rdListeningTo)).toEqual([]);
    listener.destroy();
  });
});
