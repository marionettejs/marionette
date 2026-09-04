import assert from 'node:assert/strict';
import { test } from 'node:test';
import createReduxDataApi from '../../packages/adapters/src/redux.js';
import createXStateActorApi from '../../packages/adapters/src/xstate.js';

function createSource(models) {
  let state = { models };
  let listener;
  return {
    getState: () => state,
    replace(nextModels) {
      state = { models: nextModels };
      listener();
    },
    subscribe(callback) {
      listener = callback;
      return () => { listener = undefined; };
    }
  };
}

for (const count of [1_000, 10_000]) {
  test(`keyed snapshot adapter performs one keyed pass for ${ count } models`, () => {
    const models = Array.from({ length: count }, (_, id) => ({ id }));
    const source = createSource(models);
    let keyCalls = 0;
    const DataApi = createReduxDataApi({
      key(model) {
        keyCalls++;
        return model.id;
      },
      select: state => state.models
    });
    const changes = [];
    const cleanup = DataApi.observeCollection(source, change => changes.push(change));
    keyCalls = 0;

    source.replace([...models].reverse());

    assert.equal(keyCalls, count);
    assert.deepEqual(changes, [{ kind: 'reorder' }]);
    cleanup();
  });
}

test('keyed snapshot adapter skips comparison for an unchanged selected snapshot', () => {
  const models = [{ id: 1 }];
  const source = createSource(models);
  let keyCalls = 0;
  const DataApi = createReduxDataApi({
    key(model) {
      keyCalls++;
      return model.id;
    },
    select: state => state.models
  });
  const cleanup = DataApi.observeCollection(source, () => {
    assert.fail('An unchanged snapshot must not notify.');
  });
  keyCalls = 0;

  source.replace(models);

  assert.equal(keyCalls, 0);
  cleanup();
});

function createActorSource(models) {
  let snapshot = { context: { models } };
  let listener;
  return {
    getSnapshot: () => snapshot,
    replace(nextModels) {
      snapshot = { context: { models: nextModels } };
      listener();
    },
    subscribe(callback) {
      listener = callback;
      return { unsubscribe() { listener = undefined; } };
    }
  };
}

for (const count of [1_000, 10_000]) {
  test(`XState actor adapter reconciles ${ count } actor references`, () => {
    const actors = Array.from({ length: count }, () => ({}));
    const parent = createActorSource(actors);
    const ActorApi = createXStateActorApi({
      select: snapshot => snapshot.context.models
    });
    const changes = [];
    const cleanup = ActorApi.observeCollection(parent, change => changes.push(change));

    parent.replace([...actors].reverse());

    assert.deepEqual(changes, [{ kind: 'reorder' }]);
    cleanup();
  });
}

test('XState actor adapter skips unchanged selected actor arrays', () => {
  const actors = [{}];
  const parent = createActorSource(actors);
  const ActorApi = createXStateActorApi({
    select: snapshot => snapshot.context.models
  });
  const cleanup = ActorApi.observeCollection(parent, () => {
    assert.fail('An unchanged actor array must not notify.');
  });

  parent.replace(actors);
  cleanup();
});
