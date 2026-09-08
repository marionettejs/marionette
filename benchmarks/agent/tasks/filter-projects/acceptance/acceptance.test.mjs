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
test('filter/reveal preserves domain data and row identity', () => {
  const data = Object.freeze([Object.freeze({
    id: 1,
    label: 'Alpha'
  }), Object.freeze({
    id: 2,
    label: '<Beta>'
  })]);
  const app = solution.createProjects(host(), data);
  assert.ok(app.view instanceof CollectionView);
  const original = app.view.children.toArray();
  assert.equal(original.length, 2);
  app.filter('ALP');
  assert.deepEqual(app.view.children.toArray(), [original[0]]);
  assert.equal(original[1].isDestroyed(), false);
  app.filter('missing');
  assert.equal(app.view.children.length, 0);
  app.filter('');
  assert.deepEqual(app.view.children.toArray(), original);
  assert.equal(original[1].el.textContent, '<Beta>');
  assert.equal(original[1].el.querySelector('beta'), null);
  app.destroy();
  original.forEach(row => assert.equal(row.isDestroyed(), true));
});
