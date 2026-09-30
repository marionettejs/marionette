import { describe, expect, it, vi } from 'vitest';
import { Application, Behavior, CollectionView, MnObject, Region, View } from 'marionette';
import { Collection, Model } from '@mnjs/data';
import { Events } from '@mnjs/utils';
import Backbone from 'backbone';

const owners = [
  ['MnObject', () => new MnObject()],
  ['View', () => new View()],
  ['CollectionView', () => new CollectionView()],
  ['Region', () => new Region({ el: document.createElement('div') })],
  ['Application', () => new Application()],
];

// A released source must no longer be visited when its surviving listener ends
// its subscriptions. Observe that public interaction rather than private maps.
function expectReleased(listener, ...sources) {
  const removals = sources.map(source => vi.spyOn(source, 'off'));
  listener.stopListening();
  for (const removal of removals) {
    expect(removal).not.toHaveBeenCalled();
    removal.mockRestore();
  }
}

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
      source.trigger('intent');
      source.trigger('later');
      source.trigger('destroy');
      living.trigger('intent');
      expect(intent).not.toHaveBeenCalled();
      expect(pendingOnce).not.toHaveBeenCalled();
      expect(order).toEqual(['direct', 'listener']);
      expect(stillListening).toHaveBeenCalledTimes(1);
      expectReleased(listener, source);
      living.trigger('intent');
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
    expectReleased(listener, source);
    expectReleased(source, observed);
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
    expect(started).toHaveBeenCalledTimes(1);
    await app.start();
    expect(started).toHaveBeenCalledTimes(2);

    await app.destroy();
    app.trigger('start');
    expect(started).toHaveBeenCalledTimes(2);
    expectReleased(listener, app);
    listener.destroy();
  });

  it('replaces views without accumulating references in the retained Application', async function() {
    const app = new Application();
    const region = new Region({ el: document.createElement('div') });
    const intent = vi.fn();
    const views = [];
    for (let index = 0; index < 5; index++) {
      const previous = region.currentView;
      const view = new View({ template: false });
      region.show(view);
      app.listenTo(view, { intent });
      views.push(view);
      view.trigger('intent');
      previous?.trigger('intent');
      expect(intent).toHaveBeenCalledTimes(index + 1);
    }

    region.empty();
    views.forEach(view => view.trigger('intent'));
    expect(intent).toHaveBeenCalledTimes(5);
    expectReleased(app, ...views);
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

    behavior.trigger('destroy');
    expect(destroy).not.toHaveBeenCalled();
    expectReleased(listener, behavior);
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
      behavior.trigger('destroy', view);
      expect(destroy).toHaveBeenCalledTimes(1);
      expectReleased(listener, behavior);
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
      const cleanup = vi.spyOn(behavior, 'destroy');
      const hostDestroyed = vi.fn();
      behavior.onDestroy = hostDestroyed;
      view.onBeforeDestroy = () => {
        expect(view.isDestroyed()).toBe(false);
        behavior.destroy();
        expectReleased(listener, behavior);
        behavior.trigger('intent');
        expect(intent).not.toHaveBeenCalled();
      };

      view.destroy();

      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(hostDestroyed).not.toHaveBeenCalled();
      expectReleased(listener, behavior);
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
    expectReleased(listener, view, ...behaviors);
    view.trigger('intent');
    behaviors.forEach(behavior => {
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
    const unsubscribe = vi.spyOn(source, 'off');
    listener.destroy();
    expect(unsubscribe).toHaveBeenCalled();
    source.trigger('change');
    expect(event).toHaveBeenCalledTimes(2);
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
    collection.destroy();
    collection.trigger('add', model, collection);
    expect(added).toHaveBeenCalledTimes(1);
    expectReleased(listener, collection);
    listener.destroy();
  });
});

const factories = [
  ['Object', () => new MnObject()],
  ['View', () => new View()],
  ['CollectionView', () => new CollectionView()],
  ['Region', () => new Region({ el: document.createElement('div') })],
  ['Application', () => new Application()],
  ['Model', () => new Model()],
  ['Collection', () => new Collection()]
];

// Observe public unsubscription calls: after source-side cleanup, a surviving
// listener must no longer reach the source through its listening registry.
function expectUpstreamReleased(source, listeners) {
  const off = vi.spyOn(source, 'off');
  off.mockClear();
  for (const listener of listeners) { listener.stopListening(source); }
  expect(off).not.toHaveBeenCalled();
  off.mockRestore();
}

describe('Terminal incoming listener cleanup', function() {
  for (const [name, create] of factories) {
    describe(name, function() {
      it('delivers final notifications and releases incoming and outgoing subscriptions', async function() {
        const source = create();
        const owner = new MnObject();
        const otherOwner = new MnObject();
        const otherSource = new MnObject();
        const changed = vi.fn();
        const direct = vi.fn();
        const outgoing = vi.fn();
        const surviving = vi.fn();
        const lifecycle = [];
        const options = { reason: 'finished' };
        owner.listenTo(source, 'change', changed);
        otherOwner.listenToOnce(source, 'change', changed);
        owner.listenTo(otherSource, 'change', surviving);
        source.listenTo(otherSource, 'change', outgoing);
        source.on('change', direct);
        source.once('change', direct);
        source.listenTo(source, 'change', direct);
        owner.listenTo(source, 'destroy', (instance, receivedOptions) => {
          expect(instance).toBe(source);
          expect(receivedOptions).toBe(options);
          lifecycle.push('destroy');
          owner.listenTo(source, 'late', changed);
          source.on('late', direct);
        });
        otherOwner.listenTo(source, 'all', event => {
          if (event === 'destroy') { lifecycle.push('all'); }
        });

        const result = source.destroy(options);
        if (source instanceof Application) {
          expect(await result).toBe(true);
        } else {
          expect(result).toBe(source);
        }
        expect(lifecycle).toEqual(['destroy', 'all']);
        source.trigger('change');
        source.trigger('late');
        otherSource.trigger('change');
        expect(changed).not.toHaveBeenCalled();
        expect(direct).not.toHaveBeenCalled();
        expect(outgoing).not.toHaveBeenCalled();
        expect(surviving).toHaveBeenCalledTimes(1);
        expectUpstreamReleased(source, [owner, otherOwner]);
        await source.destroy();
        expect(lifecycle).toEqual(['destroy', 'all']);
        owner.destroy();
        otherOwner.destroy();
        otherSource.destroy();
      });
    });
  }

  it('does not treat an emitted destroy event as terminal destruction', function() {
    const source = new MnObject();
    const owner = new MnObject();
    const callback = vi.fn();
    owner.listenTo(source, 'change', callback);
    source.trigger('destroy', source);
    source.trigger('change');
    expect(callback).toHaveBeenCalledTimes(1);
    expect(source.isDestroyed()).toBe(false);
    source.destroy();
    expectUpstreamReleased(source, [owner]);
    owner.destroy();
  });

  it('preserves captured callbacks when destruction occurs inside an active dispatch', function() {
    const source = new MnObject();
    const owner = new MnObject();
    const callback = vi.fn();
    source.on('change', () => source.destroy());
    owner.listenTo(source, 'change', callback);
    source.trigger('change');
    expect(callback).toHaveBeenCalledTimes(1);
    source.trigger('change');
    expect(callback).toHaveBeenCalledTimes(1);
    expectUpstreamReleased(source, [owner]);
    owner.destroy();
  });

  it('clears foreign callbacks while leaving foreign listener bookkeeping to its own API', function() {
    const source = new MnObject();
    const owner = Object.assign({}, Backbone.Events);
    const callback = vi.fn();
    owner.listenTo(source, 'change', callback);
    source.destroy();
    source.trigger('change');
    expect(callback).not.toHaveBeenCalled();
    const off = vi.spyOn(source, 'off');
    owner.stopListening(source);
    expect(off).toHaveBeenCalledExactlyOnceWith(undefined, undefined, owner);
    off.mockClear();
    owner.stopListening(source);
    expect(off).not.toHaveBeenCalled();
    off.mockRestore();
  });

  it('preserves subscriptions on a child detached from a CollectionView', function() {
    const parent = new CollectionView();
    const child = new View({ template: () => '<button>Retained</button>' });
    const owner = new MnObject();
    const callback = vi.fn();
    parent.addChildView(child);
    owner.listenTo(child, 'change', callback);
    expect(parent.detachChildView(child)).toBe(child);
    parent.destroy();
    child.trigger('change');
    expect(callback).toHaveBeenCalledTimes(1);
    expect(child.isDestroyed()).toBe(false);
    child.destroy();
    expectUpstreamReleased(child, [owner]);
    owner.destroy();
  });

  it('keeps collection subscriptions when a member model is destroyed', function() {
    const model = new Model();
    const collection = new Collection([model]);
    const owner = new MnObject();
    const destroy = vi.fn();
    const add = vi.fn();
    owner.listenTo(collection, 'destroy', destroy);
    owner.listenTo(collection, 'add', add);
    model.destroy();
    expect(destroy).toHaveBeenCalledExactlyOnceWith(model, undefined);
    collection.add({ id: 2 });
    expect(add).toHaveBeenCalledTimes(1);
    expect(collection.isDestroyed()).toBe(false);
    collection.destroy();
    expectUpstreamReleased(collection, [owner]);
    owner.destroy();
  });

  it('keeps incoming subscriptions across stop, restart, and failed destroy preparation', async function() {
    const error = new Error('not ready');
    const app = new Application();
    const owner = new MnObject();
    const callback = vi.fn();
    owner.listenTo(app, 'change', callback);
    await app.start();
    await app.stop();
    app.trigger('change');
    await app.restart();
    app.trigger('change');
    app.prepareDestroy = () => { throw error; };
    await expect(app.destroy()).rejects.toBe(error);
    expect(app.isDestroyed()).toBe(false);
    app.trigger('change');
    expect(callback).toHaveBeenCalledTimes(3);
    delete app.prepareDestroy;
    await app.destroy();
    expectUpstreamReleased(app, [owner]);
    owner.destroy();
  });

  it('keeps a detached view alive and releases each destroyed replacement from a surviving owner', function() {
    const owner = new MnObject();
    const region = new Region({ el: document.createElement('div') });
    const callback = vi.fn();
    for (let index = 0; index < 20; index++) {
      const view = new View({ template: () => '<button>Record</button>' });
      owner.listenTo(view, 'change', callback);
      region.show(view);
      expect(region.detachView()).toBe(view);
      view.trigger('change');
      region.show(view);
      region.empty();
      expect(view.isDestroyed()).toBe(true);
      view.trigger('change');
      expectUpstreamReleased(view, [owner]);
    }
    expect(callback).toHaveBeenCalledTimes(20);
    owner.destroy();
    region.destroy();
  });
});
