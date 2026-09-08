import './environment.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { View, Application } from 'marionette';
import * as solution from '../solution.mjs';
const host = () => {
  const el = document.createElement('main');
  document.body.append(el);
  return el;
};
test('owned state lifetimes follow Application and View ownership, not domain data', async() => {
  const sources = [];
  const makeState = role => {
    const state = {
      role,
      disposed: 0,
      dispose() {
        this.disposed++;
      }
    };
    sources.push(state);
    return state;
  };
  const domain = {
    id: 7,
    dispose() {
      throw new Error('Domain must not be disposed');
    }
  };
  const result = solution.createStateWorkspace(host(), makeState, domain);
  assert.ok(result.app instanceof Application);
  assert.equal(result.app.getChildApp('editor'), result.child);
  assert.equal(result.child.getName(), 'editor');
  await result.app.start();
  const firstView = result.view;
  assert.ok(firstView instanceof View);
  assert.equal(firstView.model, domain);
  assert.equal(result.child.getView(), firstView);
  assert.equal(result.app.getState().role, 'app');
  assert.equal(result.child.getState().role, 'child');
  assert.equal(firstView.getState().role, 'view');
  await result.app.stop();
  assert.equal(firstView.isDestroyed(), true);
  assert.equal(sources.find(s => s.role === 'app').disposed, 0);
  assert.equal(sources.find(s => s.role === 'child').disposed, 0);
  assert.equal(sources.find(s => s.role === 'view').disposed, 1);
  await result.app.restart();
  assert.notEqual(result.view, firstView);
  assert.equal(result.child.isRunning(), true);
  assert.equal(result.view.model, domain);
  await result.app.destroy();
  await result.app.destroy();
  assert.equal(result.child.isDestroyed(), true);
  assert.equal(sources.length, 4);
  sources.forEach(state => assert.equal(state.disposed, 1));
});
