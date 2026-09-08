import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as esmUtils from '@mnjs/utils';
import * as esmRadio from '@mnjs/radio';
import * as esmData from '@mnjs/data';

const require = createRequire(import.meta.url);
assert.throws(() => require.resolve('marionette'), { code: 'MODULE_NOT_FOUND' });
for (const [utils, { Radio, createRadio, Channel, Requests }, { Model, Collection, DataApi }] of [
  [esmUtils, esmRadio, esmData],
  [require('@mnjs/utils'), require('@mnjs/radio'), require('@mnjs/data')]
]) {
  assert.equal(Channel, Radio.Channel);
  const privateChannel = new Channel('private');
  privateChannel.reply('value', 'private');
  const service = Object.assign({}, Requests);
  service.reply('value', 'service');
  assert.equal(service.request('value'), 'service');
  assert.equal(service.on, undefined);
  const custom = createRadio();
  const activity = [];
  const warnings = [];
  custom.log = (...args) => activity.push(args);
  custom.debugLog = (...args) => warnings.push(args);
  custom.tuneIn('app');
  custom.trigger('app', 'event', 1);
  custom.setDebug();
  new custom.Channel('private').request('missing');
  assert.deepEqual(activity, [['app', 'event', 1]]);
  assert.deepEqual(warnings, [['An unhandled request was fired', 'missing', 'private']]);
  custom.tuneOut('app');
  Radio.reset();
  assert.equal(privateChannel.request('value'), 'private');
  privateChannel.reset();
  assert.equal(privateChannel.request('value'), undefined);
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
