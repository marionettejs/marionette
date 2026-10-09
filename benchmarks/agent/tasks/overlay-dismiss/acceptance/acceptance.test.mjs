import './environment.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { View, Region } from 'marionette';
import * as solution from '../solution.mjs';
const host = () => {
  const el = document.createElement('main');
  document.body.append(el);
  return el;
};
test('exclusive overlays release dismissal listeners on every public empty path', () => {
  const listeners = new Set();
  const events = {
    addEventListener(name, callback) {
      assert.equal(name, 'keydown');
      listeners.add(callback);
    },
    removeEventListener(name, callback) {
      assert.equal(name, 'keydown');
      listeners.delete(callback);
    }
  };
  const app = solution.createDismissibleOverlay(host(), events);
  assert.ok(app.region instanceof Region);
  const first = new View({
    template: false
  });
  app.open(first);
  app.open(new View({
    template: false
  }));
  assert.equal(first.isDestroyed(), true);
  assert.equal(listeners.size, 1);
  [...listeners].forEach(fn => fn({
    key: 'Enter'
  }));
  assert.equal(app.region.hasView(), true);
  const current = app.region.currentView;
  [...listeners].forEach(fn => fn({
    key: 'Escape'
  }));
  assert.equal(current.isDestroyed(), true);
  assert.equal(listeners.size, 0);
  const directlyEmptied = new View({ template: false });
  app.open(directlyEmptied);
  app.region.empty();
  assert.equal(directlyEmptied.isDestroyed(), true);
  assert.equal(listeners.size, 0);
  const externallyDestroyed = new View({ template: false });
  app.open(externallyDestroyed);
  externallyDestroyed.destroy();
  assert.equal(app.region.hasView(), false);
  assert.equal(listeners.size, 0);
  const last = new View({
    template: false
  });
  app.open(last);
  assert.equal(listeners.size, 1);
  app.destroy();
  assert.equal(last.isDestroyed(), true);
  assert.equal(listeners.size, 0);
  const later = new View({ template: false });
  app.open(later);
  assert.equal(app.region.hasView(), false);
  assert.equal(listeners.size, 0);
  assert.equal(later.isDestroyed(), false);
  later.destroy();
});
