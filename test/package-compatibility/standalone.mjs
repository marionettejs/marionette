import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as esmData from '@mnjs/data';
import * as esmUtils from '@mnjs/utils';

const require = createRequire(import.meta.url);
assert.throws(() => require.resolve('marionette'), { code: 'MODULE_NOT_FOUND' });
assert.throws(() => require.resolve('@mnjs/radio'), { code: 'MODULE_NOT_FOUND' });
assert.equal(createRequire(require.resolve('@mnjs/data/package.json')).resolve('@mnjs/utils'), require.resolve('@mnjs/utils'));
for (const [{ Model, Collection }, { Events }] of [[esmData, esmUtils], [require('@mnjs/data'), require('@mnjs/utils')]]) {
  assert.equal(Model.prototype.listenTo, Events.listenTo);
  assert.equal(Collection.prototype.listenTo, Events.listenTo);
  const model = new Model({ id: 1, label: 'first' });
  const collection = new Collection([model]);
  const listener = Object.assign({}, Events);
  const changes = [];
  listener.listenTo(model, 'change:label', current => changes.push(current.get('label')));
  model.set('label', 'second');
  assert.deepEqual(changes, ['second']);
  listener.stopListening();
  model.set('label', 'third');
  assert.deepEqual(changes, ['second']);
  assert.equal(collection.get(1), model);
  collection.destroy();
  assert.equal(model.isDestroyed(), false);
  model.destroy();
}
console.log('Standalone Data runtime passes without core or Radio.');
