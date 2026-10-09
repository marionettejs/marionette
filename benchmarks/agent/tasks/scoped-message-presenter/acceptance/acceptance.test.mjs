import './environment.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Events, MnObject, Application } from 'marionette';
import { createPresenter } from '../solution.mjs';
test('independent evented presenters release only owned subscriptions', () => {
  const source = Object.assign({}, Events); const first = []; const second = [];
  const left = createPresenter(source, value => first.push(value));
  const right = createPresenter(source, value => second.push(value));
  assert.ok(left instanceof MnObject); assert.equal(left instanceof Application, false);
  source.trigger('message', 'one'); assert.deepEqual(first, ['one']); assert.deepEqual(second, ['one']);
  left.destroy(); left.destroy(); source.trigger('message', 'two');
  assert.deepEqual(first, ['one']); assert.deepEqual(second, ['one', 'two']);
  right.destroy(); source.trigger('message', 'three'); assert.deepEqual(second, ['one', 'two']);
  let borrowed = 0; source.on('message', () => borrowed++); source.trigger('message', 'still usable'); assert.equal(borrowed, 1); source.off();
});
