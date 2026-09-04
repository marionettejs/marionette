import assert from 'node:assert/strict';
import { test } from 'node:test';
import createReduxDataApi from '../../packages/adapters/src/redux.js';

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
