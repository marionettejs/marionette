import assert from 'node:assert/strict';
import { test } from 'node:test';
import createXStateActorApi from '../../packages/adapters/src/data/xstate.ts';

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
