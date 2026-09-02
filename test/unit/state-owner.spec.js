import Application from '../../modules/application';
import Behavior from '../../modules/behavior';
import CollectionView from '../../modules/collection-view';
import MnObject from '../../modules/object';
import Region from '../../modules/region';
import View from '../../modules/view';
import MarionetteError from '../../utils/error';

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
      const owner = new OwnerClass(OwnerClass === View ? { template: false } : undefined);

      expect(Object.hasOwn(owner, '_state')).to.be.false;
      expect(Object.hasOwn(owner, '_stateOptions')).to.be.false;
      expect(Object.hasOwn(owner, '_stateEventUnsubscribe')).to.be.false;

      const state = owner.getState();
      expect(state).to.deep.equal({});
      expect(owner.getState()).to.equal(state);
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

  it('lets multiple owners borrow one source and release only their subscriptions', function() {
    const source = createSource();
    const StatefulObject = MnObject.extend({
      stateEvents: { changed: 'onChanged' },
      initialize(options) { this.handler = options.handler; },
      onChanged(...args) { this.handler(...args); }
    });
    StatefulObject.setStateApi(createStateApi());
    const firstHandler = this.sinon.spy();
    const secondHandler = this.sinon.spy();
    const first = new StatefulObject({ state: source, handler: firstHandler });
    const second = new StatefulObject({ state: source, handler: secondHandler });

    emit(source, 'changed', source, 1);
    first.destroy();
    emit(source, 'changed', source, 2);

    expect(firstHandler).to.have.been.calledOnce.and.calledWith(source, 1);
    expect(secondHandler).to.have.been.calledTwice;
    expect(source.listeners.get('changed')).to.have.lengthOf(1);
    second.destroy();
    expect(source.listeners.get('changed')).to.be.empty;
  });

  it('releases owned subscriptions before disposing the factory result exactly once', function() {
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
      subscribe() { return () => calls.push('unsubscribe'); },
      disposeOwned() { calls.push('dispose'); }
    });
    const owner = new Owner(options);

    expect(owner.getState()).to.equal(source);
    owner.off();
    owner.destroy();
    owner.destroy();
    expect(calls).to.deep.equal(['unsubscribe', 'dispose']);
  });

  it('rolls back an owned factory source after initialize fails', function() {
    const error = new Error('initialize failed');
    const source = createSource();
    const disposeOwned = this.sinon.spy();
    const Owner = MnObject.extend({
      createState() { return source; },
      initialize() {
        this.getState();
        throw error;
      }
    });
    Owner.setStateApi(createStateApi(disposeOwned));

    expect(() => new Owner()).to.throw(error);
    expect(disposeOwned).to.have.been.calledOnce.and.calledWith(source);
  });

  it('rolls back subscriptions before owned disposal when a later binding fails', function() {
    const error = new Error('second binding failed');
    const calls = [];
    const Owner = MnObject.extend({
      createState() { return createSource(); },
      stateEvents: { first: 'onEvent', second: 'onEvent' },
      onEvent() {}
    });
    Owner.setStateApi({
      subscribe(source, eventName) {
        if (eventName === 'second') { throw error; }
        return () => calls.push('unsubscribe');
      },
      disposeOwned() { calls.push('dispose'); }
    });

    expect(() => new Owner()).to.throw(error);
    expect(calls).to.deep.equal(['unsubscribe', 'dispose']);
  });

  for (const OwnerClass of [View, CollectionView]) {
    it(`rolls back ${ OwnerClass.name } state observation when later construction fails`, function() {
      const error = new Error('model subscription failed');
      const calls = [];
      const source = createSource();
      const Owner = OwnerClass.extend({
        createState() { return source; },
        stateEvents: { transition() {} },
        modelEvents: { change() {} }
      });
      Owner.setStateApi({
        subscribe() { return () => calls.push('unsubscribe'); },
        disposeOwned() { calls.push('dispose'); }
      });
      Owner.setDataApi({ subscribe() { throw error; } });

      expect(() => new Owner({ model: {} })).to.throw(error);
      expect(calls).to.deep.equal(['unsubscribe', 'dispose']);
    });
  }

  it('rolls back Behavior state observation when later construction fails', function() {
    const error = new Error('sync failed');
    const calls = [];
    const source = createSource();
    const Owner = Behavior.extend({
      createState() { return source; },
      stateEvents: { transition() {} },
      _syncElement() { throw error; }
    });
    Owner.setStateApi({
      subscribe() { return () => calls.push('unsubscribe'); },
      disposeOwned() { calls.push('dispose'); }
    });
    const view = new View();

    expect(() => new Owner({}, view)).to.throw(error);
    expect(calls).to.deep.equal(['unsubscribe', 'dispose']);
    view.destroy();
  });

  it('passes adapter event names and callback arguments through unchanged', function() {
    const source = createSource();
    const handler = this.sinon.spy();
    const api = createStateApi();
    const subscribe = this.sinon.spy(api.subscribe);
    const Owner = MnObject.extend({
      stateEvents: { 'actor.transition': 'onTransition' },
      onTransition: handler
    });
    Owner.setStateApi({ subscribe });
    const owner = new Owner({ state: source });
    const payload = { value: 'ready' };

    emit(source, 'actor.transition', payload, 42);
    expect(subscribe).to.have.been.calledWith(source, 'actor.transition', handler, owner);
    expect(handler).to.have.been.calledOnce.and.calledOn(owner).and.calledWith(payload, 42);
    owner.destroy();
  });

  it('diagnoses unsupported plain-object stateEvents', function() {
    const Owner = MnObject.extend({ stateEvents: { change() {} } });

    expect(() => new Owner({ state: {} }))
      .to.throw(MarionetteError)
      .and.include({ code: 'MN0037' });
  });

  it('diagnoses an invalid StateApi disposer and still disposes an owned source', function() {
    const disposeOwned = this.sinon.spy();
    const Owner = MnObject.extend({
      createState() { return createSource(); },
      stateEvents: { change() {} }
    });
    Owner.setStateApi({ subscribe() {}, disposeOwned });

    expect(() => new Owner()).to.throw(MarionetteError).and.include({ code: 'MN0038' });
    expect(disposeOwned).to.have.been.calledOnce;
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

  it('keeps Behavior state for the Behavior lifecycle', function() {
    const source = {};
    const StatefulBehavior = Behavior.extend({ state: source });
    const OwnerView = View.extend({ behaviors: [StatefulBehavior], template: false });
    const view = new OwnerView();
    const [behavior] = view._behaviors;

    view.render();
    expect(behavior.getState()).to.equal(source);
    view.destroy();
    expect(behavior._isDestroyed).to.be.true;
  });

  it('does not compose state into Region', function() {
    expect(Region.prototype.getState).to.be.undefined;
    expect(Region.setStateApi).to.be.undefined;
  });

  it('isolates class-level StateApi configuration', function() {
    const Parent = MnObject.extend({});
    const First = Parent.extend({});
    const Second = Parent.extend({});
    const firstApi = { subscribe: this.sinon.stub() };
    const secondApi = { subscribe: this.sinon.stub() };

    First.setStateApi(firstApi).setStateApi({ disposeOwned() {} });
    Second.setStateApi(secondApi);

    expect(First.prototype.State.subscribe).to.equal(firstApi.subscribe);
    expect(Second.prototype.State.subscribe).to.equal(secondApi.subscribe);
    expect(Parent.prototype.State).to.not.equal(First.prototype.State);
    expect(Parent.prototype.State).to.not.equal(Second.prototype.State);
  });
});
