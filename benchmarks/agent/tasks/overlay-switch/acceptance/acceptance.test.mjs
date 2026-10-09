import './environment.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { View, Region, MnObject, Application } from 'marionette';
import * as solution from '../solution.mjs';
const host = () => {
  const el = document.createElement('main');
  document.body.append(el);
  return el;
};
test('only Views enter Region and invalid open preserves current overlay', () => {
  const placements = [];
  const app = solution.createOverlayHost(host(), (...args) => placements.push(args));
  assert.ok(app.region instanceof Region);
  assert.equal(app instanceof Application, false);
  assert.equal(app instanceof MnObject, false);
  const first = new View({
    template: false
  });
  const anchor = document.createElement('button');
  app.open(first, anchor);
  assert.equal(app.region.currentView, first);
  assert.deepEqual(placements, [[first.el, anchor]]);
  assert.throws(() => app.open({}, anchor));
  const dead = new View({
    template: false
  });
  dead.destroy();
  assert.throws(() => app.open(dead, anchor));
  assert.equal(app.region.currentView, first);
  const second = new View({
    template: false
  });
  app.open(second, anchor);
  assert.equal(first.isDestroyed(), true);
  app.close();
  assert.equal(second.isDestroyed(), true);
  assert.equal(app.region.hasView(), false);
  app.destroy();
});
