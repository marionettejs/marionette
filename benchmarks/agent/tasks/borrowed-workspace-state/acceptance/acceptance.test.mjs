import './environment.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Application } from 'marionette';
import * as solution from '../solution.mjs';
const host = () => {
  const el = document.createElement('main');
  document.body.append(el);
  return el;
};
test('borrowed state and domain survive ownership changes and repeated lifecycle', async() => {
  const shared = {
    count: 3,
    dispose() {
      throw new Error('Borrowed state must not be disposed');
    }
  };
  const domain = Object.freeze({
    id: 1
  });
  const result = solution.createStateWorkspace(host(), shared, domain);
  assert.ok(result.app instanceof Application);
  assert.equal(result.app.getChildApp('editor'), result.child);
  await result.app.start();
  assert.equal(result.app.getState(), shared);
  assert.equal(result.child.getState(), shared);
  assert.equal(result.view.getState(), shared);
  assert.equal(result.view.model, domain);
  const other = new Application();
  assert.throws(() => other.addChildApp('wrong', result.child));
  assert.equal(result.app.getChildApp('editor'), result.child);
  await other.destroy();
  const first = result.view;
  shared.count = 9;
  await result.app.restart();
  assert.equal(first.isDestroyed(), true);
  assert.notEqual(result.view, first);
  assert.equal(result.view.getState(), shared);
  assert.equal(result.view.getState().count, 9);
  await result.app.destroy();
  assert.equal(result.child.isDestroyed(), true);
  assert.equal(result.view.isDestroyed(), true);
});
