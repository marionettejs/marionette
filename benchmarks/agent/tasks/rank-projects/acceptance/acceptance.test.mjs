import './environment.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CollectionView } from 'marionette';
import * as solution from '../solution.mjs';
const host = () => {
  const el = document.createElement('main');
  document.body.append(el);
  return el;
};
test('valid reorder preserves edited DOM and invalid reorder is atomic', () => {
  const app = solution.createRankedProjects(host(), [{
    id: 'a',
    label: 'A'
  }, {
    id: 'b',
    label: 'B'
  }, {
    id: 'c',
    label: 'C'
  }]);
  assert.ok(app.view instanceof CollectionView);
  const original = app.view.children.toArray();
  const input = original[0].el.querySelector('input');
  input.value = 'unsaved';
  app.reorder(['c', 'b', 'a']);
  assert.deepEqual(app.view.children.toArray(), [original[2], original[1], original[0]]);
  assert.equal(original[0].el.querySelector('input'), input);
  assert.equal(input.value, 'unsaved');
  for (const ids of [['a', 'a', 'c'], ['a', 'b'], ['a', 'b', 'unknown']]) {
    assert.throws(() => app.reorder(ids));
    assert.deepEqual(app.view.children.toArray(), [original[2], original[1], original[0]]);
  }
  app.remove('b');
  app.remove('b');
  assert.equal(original[1].isDestroyed(), true);
  app.reorder(['a', 'c']);
  assert.deepEqual(app.view.children.toArray(), [original[0], original[2]]);
  app.destroy();
});
