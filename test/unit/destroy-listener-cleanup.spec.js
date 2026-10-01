import { describe, expect, it, vi } from 'vitest';
import { Application, CollectionView, MnObject, Region, View } from 'marionette';
import { Collection, Model } from '@mnjs/data';
import Backbone from 'backbone';

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
function expectReleased(source, listeners) {
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
        expectReleased(source, [owner, otherOwner]);
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
    expectReleased(source, [owner]);
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
    expectReleased(source, [owner]);
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
    expectReleased(child, [owner]);
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
    expectReleased(collection, [owner]);
    owner.destroy();
  });

  it('keeps incoming subscriptions across stop and restart until destruction', async function() {
    const app = new Application();
    const owner = new MnObject();
    const callback = vi.fn();
    owner.listenTo(app, 'change', callback);
    await app.start();
    await app.stop();
    app.trigger('change');
    await app.restart();
    app.trigger('change');
    expect(callback).toHaveBeenCalledTimes(2);
    await app.destroy();
    expectReleased(app, [owner]);
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
      expectReleased(view, [owner]);
    }
    expect(callback).toHaveBeenCalledTimes(20);
    owner.destroy();
    region.destroy();
  });
});
