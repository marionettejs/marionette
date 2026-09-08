import { vi, describe, it, expect } from 'vitest';
import { Application, Behavior, CollectionView, MnObject, Region, View } from 'marionette';
import { MarionetteError } from '@mnjs/utils';

function createSource() {
  return { listeners: new Map() };
}

function createStateApi(onDispose) {
  return {
    subscribe(source, eventName, callback, context) {
      const listeners = source.listeners.get(eventName) || [];
      const listener = { callback, context };
      listeners.push(listener);
      source.listeners.set(eventName, listeners);
      return () => {
        const index = listeners.indexOf(listener);
        if (index !== -1) { listeners.splice(index, 1); }
      };
    },
    disposeOwned(source) { onDispose?.(source); }
  };
}

function emit(source, eventName, ...args) {
  for (const { callback, context } of source.listeners.get(eventName) || []) {
    callback.apply(context, args);
  }
}

describe('state source composition', function() {
  const OwnerClasses = [MnObject, View, CollectionView, Application];

  for (const OwnerClass of OwnerClasses) {
    it(`${ OwnerClass.name } stays allocation-free until state is requested`, async function() {
      const createState = vi.fn(() => ({}));
      const Owner = OwnerClass.extend({ createState });
      const owner = new Owner(OwnerClass === View ? { template: false } : undefined);

      expect(createState).not.toHaveBeenCalled();

      const state = owner.getState();
      expect(state).to.deep.equal({});
      expect(owner.getState()).to.equal(state);
      expect(createState).toHaveBeenCalledTimes(1);
      await owner.destroy();
    });
  }

  it('keeps a supplied plain object exact and borrowed', function() {
    const state = { filter: '' };
    const owner = new MnObject({ state });

    expect(owner.getState()).to.equal(state);
    owner.getState().filter = 'active';
    owner.destroy();
    expect(state).to.deep.equal({ filter: 'active' });
  });

  it('treats a supplied function as the exact source', function() {
    const state = function() {};
    const owner = new MnObject({ state });

    expect(owner.getState()).to.equal(state);
    owner.destroy();
  });

  it('treats an explicit undefined state as no supplied source', function() {
    const owner = new MnObject({ state: undefined });

    expect(owner.getState()).to.deep.equal({});
    owner.destroy();
  });

  it('retries a failed state factory with its original options', function() {
    const error = new Error('state unavailable');
    const options = { marker: true };
    const source = {};
    let attempts = 0;
    const Owner = MnObject.extend({
      createState(factoryOptions) {
        expect(factoryOptions).to.equal(options);
        if (!attempts++) { throw error; }
        return source;
      }
    });
    const owner = new Owner(options);

    expect(() => owner.getState()).to.throw(error);
    expect(owner.getState()).to.equal(source);
    owner.destroy();
  });

  it('lets multiple owners borrow one source and release only their subscriptions', function() {
    const source = createSource();
    const StatefulObject = MnObject.extend({
      stateEvents: { changed: 'onChanged' },
      initialize(options) { this.handler = options.handler; },
      onChanged(...args) { this.handler(...args); }
    });
    StatefulObject.setStateApi(createStateApi());
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();
    const first = new StatefulObject({ state: source, handler: firstHandler });
    const second = new StatefulObject({ state: source, handler: secondHandler });

    emit(source, 'changed', source, 1);
    first.destroy();
    emit(source, 'changed', source, 2);

    expect(firstHandler).toHaveBeenCalledTimes(1);
    expect(firstHandler.mock.calls.map(args => args.slice(0, 2))).toContainEqual([source, 1]);
    expect(secondHandler).toHaveBeenCalledTimes(2);
    expect(source.listeners.get('changed')).to.have.lengthOf(1);
    second.destroy();
    expect(source.listeners.get('changed')).toHaveLength(0);
  });

  it('releases owned subscriptions before disposing the owned source exactly once', function() {
    const calls = [];
    const source = createSource();
    const options = {};
    const Owner = MnObject.extend({
      createState(factoryOptions) {
        expect(factoryOptions).to.equal(options);
        return source;
      },
      stateEvents: { transition: 'onTransition' },
      onTransition() {}
    });
    Owner.setStateApi({
      subscribe() { return () => calls.push('cleanup'); },
      disposeOwned() { calls.push('dispose'); }
    });
    const owner = new Owner(options);

    expect(owner.getState()).to.equal(source);
    owner.off();
    owner.destroy();
    owner.destroy();
    expect(calls).to.deep.equal(['cleanup', 'dispose']);
  });

  it('immediately disposes owned state first requested after destruction', function() {
    const source = createSource();
    const disposeOwned = vi.fn();
    const Owner = MnObject.extend({ createState() { return source; } });
    Owner.setStateApi(createStateApi(disposeOwned));
    const owner = new Owner();

    owner.destroy();

    expect(owner.getState()).to.equal(source);
    expect(disposeOwned).toHaveBeenCalledTimes(1);
    expect(disposeOwned.mock.calls.map(args => args.slice(0, 1))).toContainEqual([source]);
  });

  it('does not initialize state events after destruction', function() {
    const subscribe = vi.fn();
    const Owner = MnObject.extend({
      stateEvents: { change() {} },
      initialize() { this.destroy(); }
    });
    Owner.setStateApi({ subscribe });
    const owner = new Owner();

    expect(owner.isDestroyed()).toBe(true);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('passes adapter event names and callback arguments through unchanged', function() {
    const source = createSource();
    const handler = vi.fn();
    const api = createStateApi();
    const subscribe = vi.fn(api.subscribe);
    const Owner = MnObject.extend({
      stateEvents: { 'actor.transition': 'onTransition' },
      onTransition: handler
    });
    Owner.setStateApi({ subscribe });
    const owner = new Owner({ state: source });
    const payload = { value: 'ready' };

    emit(source, 'actor.transition', payload, 42);
    expect(subscribe.mock.calls.map(args => args.slice(0, 4))).toContainEqual([source, 'actor.transition', handler, owner]);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.contexts).toContain(owner);
    expect(handler.mock.calls.map(args => args.slice(0, 2))).toContainEqual([payload, 42]);
    owner.destroy();
  });

  it('diagnoses unsupported plain-object stateEvents', function() {
    const Owner = MnObject.extend({ stateEvents: { change() {} } });

    expect(() => new Owner({ state: {} }))
      .to.throw(MarionetteError)
      .and.include({ code: 'MN0037' });
  });

  it('preserves View and CollectionView state across render', function() {
    const viewState = {};
    const collectionState = {};
    const view = new View({ state: viewState, template: false });
    const collectionView = new CollectionView({ state: collectionState });

    view.render();
    collectionView.render();
    expect(view.getState()).to.equal(viewState);
    expect(collectionView.getState()).to.equal(collectionState);
    view.destroy();
    collectionView.destroy();
  });

  it('reads a supplied state option once', function() {
    const source = {};
    const options = {};
    const getStateOption = vi.fn().mockReturnValue(source);
    Object.defineProperty(options, 'state', { get: getStateOption });

    const owner = new MnObject(options);

    expect(getStateOption).toHaveBeenCalledTimes(1);
    expect(owner.getState()).to.equal(source);
    owner.destroy();
  });

  it('keeps Behavior state for the Behavior lifecycle', function() {
    const source = {};
    const onDestroy = vi.fn();
    let behavior;
    const StatefulBehavior = Behavior.extend({
      state: source,
      initialize() { behavior = this; },
      onDestroy
    });
    const OwnerView = View.extend({ behaviors: [StatefulBehavior], template: false });
    const view = new OwnerView();

    view.render();
    expect(behavior.getState()).to.equal(source);
    view.destroy();
    expect(onDestroy).toHaveBeenCalledTimes(1);
    view.triggerMethod('destroy', view);
    expect(onDestroy).toHaveBeenCalledTimes(1);
  });

  it('does not compose state into Region', function() {
    expect(Region.prototype.getState).toBeUndefined();
    expect(Region.setStateApi).toBeUndefined();
  });

  it('isolates class-level StateApi configuration', function() {
    const Parent = MnObject.extend({});
    const First = Parent.extend({});
    const Second = Parent.extend({});
    const firstApi = { subscribe: vi.fn() };
    const secondApi = { subscribe: vi.fn() };

    First.setStateApi(firstApi).setStateApi({ disposeOwned() {} });
    Second.setStateApi(secondApi);

    expect(First.prototype.State.subscribe).to.equal(firstApi.subscribe);
    expect(Second.prototype.State.subscribe).to.equal(secondApi.subscribe);
    expect(Parent.prototype.State).to.not.equal(First.prototype.State);
    expect(Parent.prototype.State).to.not.equal(Second.prototype.State);
  });
});
