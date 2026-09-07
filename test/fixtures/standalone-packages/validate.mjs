import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as esmUtils from '@marionette/utils';
import * as esmRadio from '@marionette/radio';
import * as esmData from '@marionette/data';

const require = createRequire(import.meta.url);
assert.throws(() => require.resolve('marionette'), { code: 'MODULE_NOT_FOUND' });
for (const [utils, { Radio, createRadio }, { Model, Collection, DataApi }] of [
  [esmUtils, esmRadio, esmData],
  [require('@marionette/utils'), require('@marionette/radio'), require('@marionette/data')]
]) {
  const model = new Model({ name: 'first' });
  const listener = Object.assign({}, utils.Events);
  const names = [];
  listener.listenTo(model, 'change:name', current => names.push(current.get('name')));
  const channel = Radio.channel('standalone');
  channel.reply('model', () => model);
  channel.on('rename', name => model.set('name', name));
  channel.trigger('rename', 'second');
  assert.equal(Radio.request('standalone', 'model'), model);
  assert.deepEqual(names, ['second']);
  listener.stopListening();
  model.set('name', 'third');
  assert.deepEqual(names, ['second']);
  const collection = new Collection([model]);
  assert.equal(DataApi.models(collection)[0], model);
  const other = createRadio();
  assert.notEqual(other.channel('standalone'), channel);
  assert.equal(other.request('standalone', 'model'), undefined);
  Radio.reset();
  assert.equal(Radio.request('standalone', 'model'), undefined);
}
console.log('Standalone ESM and CommonJS Events, Radio, and data pass without core installed.');
