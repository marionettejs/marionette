import { configureStore, createSlice } from '@reduxjs/toolkit';
import { createStore as createXStateStore } from '@xstate/store';
import { createStore as createZustandStore } from 'zustand/vanilla';
import { createMarionette } from '../../src/index.js';
import createReduxDataApi from '../../packages/adapters/src/redux.js';
import createXStateStoreDataApi from '../../packages/adapters/src/xstate-store.js';
import createZustandDataApi from '../../packages/adapters/src/zustand.js';

const initialModels = () => [
  { id: 1, label: 'one' },
  { id: 2, label: 'two' }
];

const providers = [
  {
    name: 'Redux Toolkit',
    createDataApi: createReduxDataApi,
    readName: 'getState',
    createSource(models) {
      const slice = createSlice({
        name: 'models',
        initialState: { models, unrelated: 0 },
        reducers: {
          replace(state, action) { state.models = action.payload; },
          updateUnrelated(state) { state.unrelated++; }
        }
      });
      const source = configureStore({ reducer: slice.reducer });
      return {
        source,
        replace(nextModels) { source.dispatch(slice.actions.replace(nextModels)); },
        updateUnrelated() { source.dispatch(slice.actions.updateUnrelated()); }
      };
    },
    select: state => state.models
  },
  {
    name: 'Zustand vanilla',
    createDataApi: createZustandDataApi,
    readName: 'getState',
    createSource(models) {
      const source = createZustandStore(() => ({ models, unrelated: 0 }));
      return {
        source,
        replace(nextModels) { source.setState({ models: nextModels }); },
        updateUnrelated() {
          source.setState(state => ({ unrelated: state.unrelated + 1 }));
        }
      };
    },
    select: state => state.models
  },
  {
    name: 'XState Store',
    createDataApi: createXStateStoreDataApi,
    readName: 'getSnapshot',
    createSource(models) {
      const source = createXStateStore({
        context: { models, unrelated: 0 },
        on: {
          replace: (context, event) => ({ ...context, models: event.models }),
          updateUnrelated: context => ({ ...context, unrelated: context.unrelated + 1 })
        }
      });
      return {
        source,
        replace(nextModels) { source.trigger.replace({ models: nextModels }); },
        updateUnrelated() { source.trigger.updateUnrelated(); }
      };
    },
    select: snapshot => snapshot.context.models
  }
];

describe('keyed snapshot adapters', function() {
  providers.forEach(({ name, createDataApi, createSource, readName, select }) => {
    describe(name, function() {
      let DataApi;
      let keyCalls;
      let store;

      beforeEach(function() {
        keyCalls = 0;
        store = createSource(initialModels());
        DataApi = createDataApi({
          key(model) {
            keyCalls++;
            return model.id;
          },
          select
        });
      });

      it('reconciles additions, removals, reorders, and immutable replacements', function() {
        const runtime = createMarionette();
        const ChildView = runtime.View.extend({
          template: model => model.label,
          onRender() { this.renderCount = (this.renderCount || 0) + 1; }
        });
        const ListView = runtime.CollectionView.extend({ childView: ChildView });
        ChildView.setDataApi(DataApi);
        ListView.setDataApi(DataApi);
        const view = new ListView({ collection: store.source }).render();
        const [first, second] = DataApi.models(store.source);
        const firstView = view.children.findByModel(first);
        const secondView = view.children.findByModel(second);
        const third = { id: 3, label: 'three' };

        store.replace([second, first, third]);
        expect(view.children.toArray().map(child => child.model))
          .to.deep.equal([second, first, third]);
        expect(view.children.findByModel(first)).to.equal(firstView);
        expect(view.children.findByModel(second)).to.equal(secondView);

        const current = { id: 1, label: 'current' };
        store.replace([third, current]);
        const currentView = view.children.findByModel(current);

        expect(firstView.isDestroyed()).to.be.true;
        expect(secondView.isDestroyed()).to.be.true;
        expect(currentView).to.not.equal(firstView);
        expect(currentView.model).to.equal(current);
        expect(currentView.renderCount).to.equal(1);
        expect(view.children.toArray().map(child => child.model)).to.deep.equal([third, current]);
        view.destroy();
      });

      it('ignores source notifications when the selected array is unchanged', function() {
        const callback = this.sinon.spy();
        const cleanup = DataApi.observeCollection(store.source, callback);
        keyCalls = 0;

        store.updateUnrelated();

        expect(callback).to.not.have.been.called;
        expect(keyCalls).to.equal(0);
        cleanup();
      });

      it('distinguishes equivalent new arrays from pure reorders', function() {
        const callback = this.sinon.spy();
        const cleanup = DataApi.observeCollection(store.source, callback);
        const models = DataApi.models(store.source);
        keyCalls = 0;

        store.replace([...models]);

        expect(callback).to.not.have.been.called;
        expect(keyCalls).to.equal(models.length);

        store.replace([...models].reverse());

        expect(callback).to.have.been.calledOnce.and.calledWith({ kind: 'reorder' });
        expect(keyCalls).to.equal(models.length * 2);
        cleanup();
      });

      it('supports multiple observers and idempotent cleanup', function() {
        const first = this.sinon.spy();
        const second = this.sinon.spy();
        const stopFirst = DataApi.observeCollection(store.source, first);
        const stopSecond = DataApi.observeCollection(store.source, second);
        const models = DataApi.models(store.source);

        store.replace([...models, { id: 3 }]);
        stopFirst();
        stopFirst();
        store.replace(models);

        expect(first).to.have.been.calledOnce;
        expect(second).to.have.been.calledTwice;
        stopSecond();
      });

      it('diagnoses missing provider methods', function() {
        const readOnlySource = {
          [readName]: () => readName === 'getSnapshot' ?
            { context: { models: [] } } : { models: [] }
        };

        expect(() => DataApi.models(null))
          .to.throw(TypeError, `store with ${ readName }()`);
        expect(() => DataApi.observeCollection(readOnlySource, () => {}))
          .to.throw(TypeError, 'store with subscribe()');
      });
    });
  });

  it('requires an explicit stable key and selector', function() {
    expect(() => createReduxDataApi())
      .to.throw(TypeError, 'Redux adapter requires a key function.');
    expect(() => createReduxDataApi({ select: state => state.models }))
      .to.throw(TypeError, 'Redux adapter requires a key function.');
    expect(() => createReduxDataApi({ key: model => model.id }))
      .to.throw(TypeError, 'Redux adapter requires a selector function.');
  });

  it('diagnoses invalid sources, selector results, keys, and disposers', function() {
    const DataApi = createReduxDataApi({ key: model => model.id, select: state => state.models });
    const invalidModels = { getState: () => ({ models: {} }), subscribe() { return () => {}; } };
    const missingSnapshot = { getState: () => undefined, subscribe() { return () => {}; } };
    const missingKey = { getState: () => ({ models: [{}] }), subscribe() { return () => {}; } };
    const duplicateKey = {
      getState: () => ({ models: [{ id: 1 }, { id: 1 }] }),
      subscribe() { return () => {}; }
    };
    const invalidDisposer = {
      getState: () => ({ models: [] }),
      subscribe() { return {}; }
    };

    expect(() => DataApi.models(missingSnapshot))
      .to.throw(TypeError, 'missing synchronous snapshot');
    expect(() => DataApi.models(invalidModels)).to.throw(TypeError, 'ordered array');
    expect(() => DataApi.observeCollection(missingKey, () => {}))
      .to.throw(TypeError, 'missing value at index 0');
    expect(() => DataApi.observeCollection(duplicateKey, () => {}))
      .to.throw(TypeError, 'duplicate value "1"');
    expect(() => DataApi.observeCollection(invalidDisposer, () => {}))
      .to.throw(TypeError, 'subscribe must return a disposer');
  });

  it('normalizes reentrant notifications against the latest observed snapshot', function() {
    const first = { id: 1 };
    const second = { id: 2 };
    const third = { id: 3 };
    let state = { models: [first] };
    let listener;
    const source = {
      getState: () => state,
      subscribe(callback) {
        listener = callback;
        return () => { listener = undefined; };
      }
    };
    const DataApi = createReduxDataApi({
      key: model => model.id,
      select: current => current.models
    });
    const changes = [];
    const cleanup = DataApi.observeCollection(source, change => {
      changes.push(change);
      if (changes.length === 1) {
        state = { models: [first, second, third] };
        listener();
      }
    });

    state = { models: [first, second] };
    listener();

    expect(changes).to.deep.equal([
      { kind: 'update', added: [second], removed: [], updated: [] },
      { kind: 'update', added: [third], removed: [], updated: [] }
    ]);
    cleanup();
  });

  it('forces a reset after a consumer callback fails', function() {
    const first = { id: 1 };
    const second = { id: 2 };
    let state = { models: [first] };
    let listener;
    const source = {
      getState: () => state,
      subscribe(callback) {
        listener = callback;
        return () => {};
      }
    };
    const error = new Error('reconciliation failed');
    const callback = this.sinon.stub();
    callback.onFirstCall().throws(error);
    const DataApi = createReduxDataApi({
      key: model => model.id,
      select: current => current.models
    });
    DataApi.observeCollection(source, callback);

    state = { models: [first, second] };
    expect(() => listener()).to.throw(error);
    listener();

    expect(callback).to.have.been.calledTwice;
    expect(callback.secondCall).to.have.been.calledWith({ kind: 'reset' });
  });

  it('recovers after an update introduces duplicate keys', function() {
    const first = { id: 1 };
    const second = { id: 2 };
    let state = { models: [first] };
    let listener;
    const source = {
      getState: () => state,
      subscribe(callback) {
        listener = callback;
        return () => {};
      }
    };
    const callback = this.sinon.spy();
    const DataApi = createReduxDataApi({
      key: model => model.id,
      select: current => current.models
    });
    DataApi.observeCollection(source, callback);

    state = { models: [first, { id: 1 }] };
    expect(() => listener()).to.throw(TypeError, 'duplicate value "1"');

    state = { models: [first, second] };
    listener();

    expect(callback).to.have.been.calledOnce.and.calledWith({
      kind: 'update', added: [second], removed: [], updated: []
    });
  });
});
