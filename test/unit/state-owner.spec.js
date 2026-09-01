import Behavior from '../../modules/behavior';
import CollectionView from '../../modules/collection-view';
import MnObject from '../../modules/object';
import State from '../../modules/state';
import View from '../../modules/view';

function buildBehavior(BehaviorClass = Behavior, options) {
  const behaviorDefinition = options ? {
    behaviorClass: BehaviorClass,
    ...options
  } : BehaviorClass;
  const OwnerView = View.extend({
    behaviors: [behaviorDefinition],
    template: false
  });
  const view = new OwnerView();

  return { owner: view._behaviors[0], view };
}

const ownerDefinitions = [
  {
    name: 'MnObject',
    OwnerClass: MnObject,
    build(OwnerClass = MnObject, options) {
      return { owner: new OwnerClass(options) };
    },
    destroy({ owner }) {
      owner.destroy();
    }
  },
  {
    name: 'View',
    OwnerClass: View,
    build(OwnerClass = View, options) {
      return { owner: new OwnerClass(options) };
    },
    destroy({ owner }) {
      owner.destroy();
    }
  },
  {
    name: 'CollectionView',
    OwnerClass: CollectionView,
    build(OwnerClass = CollectionView, options) {
      return { owner: new OwnerClass(options) };
    },
    destroy({ owner }) {
      owner.destroy();
    }
  },
  {
    name: 'Behavior',
    OwnerClass: Behavior,
    build(OwnerClass = Behavior, options) {
      return buildBehavior(OwnerClass, options);
    },
    destroy({ view }) {
      view.destroy();
    }
  }
];

describe('State owner composition', function() {
  it('accepts null constructor options without activating State', function() {
    const owner = new MnObject(null);

    expect(Object.hasOwn(owner, '_state')).to.be.false;

    owner.destroy();
  });

  for (const definition of ownerDefinitions) {
    describe(definition.name, function() {
      it('does not allocate State until requested', function() {
        const result = definition.build();
        const { owner } = result;

        expect(Object.hasOwn(owner, '_state')).to.be.false;
        expect(Object.hasOwn(owner, '_stateDefinition')).to.be.false;

        const state = owner.getState();

        expect(state).to.be.instanceOf(State);
        expect(owner.getState()).to.equal(state);

        definition.destroy(result);
      });

      it('activates declared State before initialize', function() {
        let initializedState;
        const OwnerClass = definition.OwnerClass.extend({
          state: { ready: true },
          initialize() {
            initializedState = this.getState();
          }
        });
        const result = definition.build(OwnerClass);

        expect(initializedState.get('ready')).to.be.true;

        definition.destroy(result);
      });

      it('destroys supplied State when initialize throws', function() {
        const error = new Error('initialize failed');
        const state = new State();
        const OwnerClass = definition.OwnerClass.extend({
          initialize() {
            throw error;
          }
        });

        expect(() => definition.build(OwnerClass, { state })).to.throw(error);
        expect(state.isDestroyed()).to.be.true;
      });

      it('destroys supplied State when stateEvents throws', function() {
        const error = new Error('stateEvents failed');
        const state = new State();
        const OwnerClass = definition.OwnerClass.extend({
          stateEvents() {
            throw error;
          }
        });

        expect(() => definition.build(OwnerClass, { state })).to.throw(error);
        expect(state.isDestroyed()).to.be.true;
      });

      it('composes a supplied State and destroys it with its owner', function() {
        const state = new State({ ready: true });
        const result = definition.build(undefined, { state });

        expect(result.owner.getState()).to.equal(state);

        definition.destroy(result);

        expect(state.isDestroyed()).to.be.true;
      });

      it('binds stateEvents with the owner as context', function() {
        const onReady = this.sinon.stub();
        const result = definition.build(undefined, {
          stateEvents: { 'change:ready': onReady }
        });
        const state = result.owner.getState();

        state.set('ready', true);

        expect(onReady).to.have.been.calledOnce.and.calledOn(result.owner);

        definition.destroy(result);
      });

      it('returns a destroyed State when first requested after owner destroy', function() {
        const result = definition.build();

        definition.destroy(result);

        expect(result.owner.getState().isDestroyed()).to.be.true;
      });
    });
  }

  it('resolves a State declaration with the owner as context', function() {
    let context;
    const Owner = MnObject.extend({
      state() {
        context = this;
        return new State({ ready: true });
      }
    });
    const owner = new Owner();

    expect(context).to.equal(owner);
    expect(owner.getState().get('ready')).to.be.true;

    owner.destroy();
  });

  for (const OwnerClass of [View, CollectionView]) {
    it(`destroys earlier Behavior State when ${ OwnerClass.name } Behavior composition fails`, function() {
      const error = new Error('behavior failed');
      const firstState = new State();
      const secondState = new State();
      const BrokenBehavior = Behavior.extend({
        initialize() {
          throw error;
        }
      });
      const Owner = OwnerClass.extend({
        behaviors: [
          { behaviorClass: Behavior, state: firstState },
          { behaviorClass: Behavior, state: secondState },
          BrokenBehavior
        ]
      });

      expect(() => new Owner()).to.throw(error);
      expect(firstState.isDestroyed()).to.be.true;
      expect(secondState.isDestroyed()).to.be.true;
    });
  }

  it('continues Behavior rollback and preserves the construction error when destroy throws', function() {
    const constructionError = new Error('behavior failed');
    const firstState = new State();
    const secondState = new State();
    const ThrowingBehavior = Behavior.extend({
      destroy() {
        Behavior.prototype.destroy.call(this);
        throw new Error('destroy failed');
      }
    });
    const BrokenBehavior = Behavior.extend({
      initialize() {
        throw constructionError;
      }
    });
    const Owner = View.extend({
      behaviors: [
        { behaviorClass: ThrowingBehavior, state: firstState },
        { behaviorClass: Behavior, state: secondState },
        BrokenBehavior
      ]
    });

    expect(() => new Owner()).to.throw(constructionError);
    expect(firstState.isDestroyed()).to.be.true;
    expect(secondState.isDestroyed()).to.be.true;
  });

  it('reads a State declaration once', function() {
    const state = new State({ ready: true });
    const Owner = MnObject.extend({});
    const readState = this.sinon.stub().returns(state);
    Object.defineProperty(Owner.prototype, 'state', {
      configurable: true,
      get: readState
    });

    const owner = new Owner();

    expect(readState).to.have.been.calledOnce.and.calledOn(owner);
    expect(owner.getState()).to.equal(state);

    owner.destroy();
  });

  it('resolves a State constructor option with the owner as context', function() {
    let context;
    const owner = new MnObject({
      state() {
        context = this;
        return { ready: true };
      }
    });

    expect(context).to.equal(owner);
    expect(owner.getState().get('ready')).to.be.true;

    owner.destroy();
  });

  it('resolves stateEvents once during composition', function() {
    const onReady = this.sinon.stub();
    const stateEvents = this.sinon.stub().returns({ 'change:ready': onReady });
    const Owner = MnObject.extend({ stateEvents });
    const owner = new Owner();

    owner.getState().set('ready', true);

    expect(stateEvents).to.have.been.calledOnce.and.calledOn(owner);
    expect(onReady).to.have.been.calledOnce;

    owner.destroy();
  });

  it('binds stateEvents after initialize', function() {
    const onReady = this.sinon.stub();
    const Owner = MnObject.extend({
      initialize() {
        this.onReady = onReady;
        this.getState().set('ready', true);
      },
      stateEvents: { 'change:ready': 'onReady' }
    });
    const owner = new Owner();

    expect(onReady).to.not.have.been.called;

    owner.getState().set('ready', false);

    expect(onReady).to.have.been.calledOnce;

    owner.destroy();
  });

  it('does not activate stateEvents after initialize destroys the owner', function() {
    const Owner = MnObject.extend({
      initialize() {
        this.destroy();
      },
      stateEvents: { change() {} }
    });
    const owner = new Owner();

    expect(Object.hasOwn(owner, '_state')).to.be.false;
  });

  it('rejects a State already composed into another owner', function() {
    const state = new State();
    const firstOwner = new MnObject({ state });

    expect(() => new View({ state }))
      .to.throw('A State instance must be live and unowned before composition.')
      .with.property('code', 'MN0035');

    firstOwner.destroy();
  });

  it('rejects a destroyed State', function() {
    const state = new State();
    state.destroy();

    expect(() => new MnObject({ state }))
      .to.throw('A State instance must be live and unowned before composition.')
      .with.property('code', 'MN0035');
  });

  it('releases ownership when State was destroyed before its owner', function() {
    const state = new State();
    const owner = new MnObject({ state });

    state.destroy();
    owner.destroy();

    expect(state._owner).to.be.undefined;
  });

  it('preserves View and CollectionView State across render', function() {
    const view = new View({ state: { count: 1 }, template: false });
    const collectionView = new CollectionView({ state: { count: 1 } });
    const viewState = view.getState();
    const collectionState = collectionView.getState();

    view.render();
    collectionView.render();

    expect(view.getState()).to.equal(viewState);
    expect(collectionView.getState()).to.equal(collectionState);

    view.destroy();
    collectionView.destroy();
  });

  it('preserves Behavior State across its View render', function() {
    const StatefulBehavior = Behavior.extend({ state: { count: 1 } });
    const { owner, view } = buildBehavior(StatefulBehavior);
    const state = owner.getState();

    view.render();

    expect(owner.getState()).to.equal(state);

    view.destroy();
  });

  it('resolves Behavior State after its element is available', function() {
    let resolvedElement;
    const StatefulBehavior = Behavior.extend({
      state() {
        resolvedElement = this.el;
        return {};
      }
    });
    const { view } = buildBehavior(StatefulBehavior);

    expect(resolvedElement).to.equal(view.el);

    view.destroy();
  });

  it('keeps State separate between Behaviors on one View', function() {
    const StatefulBehavior = Behavior.extend({ state: { count: 0 } });
    const OwnerView = View.extend({
      behaviors: [StatefulBehavior, StatefulBehavior],
      template: false
    });
    const view = new OwnerView();
    const [first, second] = view._behaviors;

    first.getState().set('count', 1);

    expect(first.getState()).to.not.equal(second.getState());
    expect(second.getState().get('count')).to.equal(0);

    first.destroy();

    expect(first.getState().isDestroyed()).to.be.true;
    expect(second.getState().isDestroyed()).to.be.false;

    view.destroy();
  });
});
