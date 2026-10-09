import './environment.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import 'marionette';
import * as solution from '../solution.mjs';
const host = () => {
  const el = document.createElement('main');
  document.body.append(el);
  return el;
};
test('independent Regions and navigation cleanup', () => {
  const calls = [];
  const app = solution.createNoticeShell(host(), value => calls.push(value));
  const nav = app.view.getChildView('navigation');
  const button = nav.el.querySelector('button');
  button.click();
  const first = app.notify('One');
  const second = app.notify('<img>');
  assert.equal(first.isDestroyed(), true);
  assert.equal(second.el.textContent, '<img>');
  assert.equal(app.view.getChildView('navigation'), nav);
  button.click();
  assert.deepEqual(calls, ['home', 'home']);
  app.destroy();
  button.click();
  assert.deepEqual(calls, ['home', 'home']);
  assert.equal(second.isDestroyed(), true);
  assert.equal(nav.isDestroyed(), true);
});
