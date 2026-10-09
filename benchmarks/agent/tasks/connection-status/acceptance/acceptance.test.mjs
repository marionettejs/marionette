import './environment.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { View } from 'marionette';
import * as solution from '../solution.mjs';
const host = () => {
  const el = document.createElement('main');
  document.body.append(el);
  return el;
};
test('provider subscription survives rerender and is released once', () => {
  const subscribers = new Set();
  let stopped = 0;
  const provider = {
    subscribe(callback) {
      subscribers.add(callback);
      callback('<Initial>');
      return () => {
        stopped++;
        subscribers.delete(callback);
      };
    }
  };
  const el = host();
  const preexisting = document.createElement('p');
  preexisting.textContent = 'Preexisting host markup';
  el.append(preexisting);
  const view = solution.createConnectionStatus(el, provider);
  assert.ok(view instanceof View);
  assert.equal(view.isRendered(), true);
  assert.equal(view.el.querySelector('output').textContent, '<Initial>');
  assert.equal(view.el.contains(preexisting), false);
  assert.equal(subscribers.size, 1);
  const emit = value => [...subscribers].forEach(callback => callback(value));
  emit('<Ready>');
  assert.equal(view.el.querySelector('output').textContent, '<Ready>');
  view.render();
  assert.equal(subscribers.size, 1);
  assert.equal(view.el.querySelector('output').textContent, '<Ready>');
  view.destroy();
  view.destroy();
  assert.equal(subscribers.size, 0);
  assert.equal(stopped, 1);
  emit('late');
});
