import assert from 'node:assert/strict';
import { Model, Collection } from '@converse/skeletor';
import SkeletorApi from '@mnjs/adapters/skeletor';

class Item extends Model {
  get computed() { return { label: { deps: ['title'], fn: model => `${model.get('title')}!` } }; }
}
const model = new Item({ id: 1, title: 'First' });
assert.equal(SkeletorApi.serialize(model).label, 'First!');
assert.equal(SkeletorApi.has(model, 'label'), true);
assert.equal(SkeletorApi.get(model, 'label'), 'First!');
assert.deepEqual(model.toJSON(), { id: 1, title: 'First' });
const collection = new Collection([model]);
const calls = [];
const stop = SkeletorApi.observeCollection(collection, change => calls.push(change));
collection.add({ id: 2, title: 'Second' });
assert.equal(calls.length, 1);
stop(); stop();
assert.deepEqual(SkeletorApi.models(collection), collection.models);
