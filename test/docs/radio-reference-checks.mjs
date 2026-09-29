// Outcome checks run after the canonical Radio reference's actual code fences.
export const assertions = {
  'packages-radio-1': `
assert.equal(theme, 'dark');
assert.deepEqual(changes, ['dark']);
const { Radio: coreRadio, createMarionette } = await import('marionette');
const { createRadio } = await import('@mnjs/radio');
assert.equal(coreRadio, Radio);
assert.equal(Radio.channel('preferences'), preferences);
assert.equal(Radio.on('preferences', 'checked', () => {}), preferences);
assert.notEqual(createRadio().channel('preferences'), preferences);
assert.notEqual(createMarionette().Radio.channel('preferences'), preferences);
const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);
const commonJSRadio = require('@mnjs/radio');
assert.equal(require('marionette').Radio, commonJSRadio.Radio);
assert.notEqual(commonJSRadio.Radio, Radio);
assert.notEqual(commonJSRadio.Radio.channel('preferences'), preferences);
for (const registry of [createRadio(), commonJSRadio.createRadio()]) {
  registry.reply('retained', 'value', 42);
  for (const name of [undefined, '']) {
    assert.throws(() => registry.reset(name), error => error.code === 'MN0017');
    assert.equal(registry.request('retained', 'value'), 42);
  }
  assert.equal(registry.reset(), undefined);
  assert.equal(registry.request('retained', 'value'), undefined);

  const source = new registry.Channel('source');
  const delivered = [];
  assert.throws(() => registry.reset('listener'), error => error.code === 'MN0021');
  const listener = registry.listenTo('listener', source, 'value', function(value) {
    delivered.push([this, value]);
  });
  assert.equal(listener, registry.channel('listener'));
  source.trigger('value', 7);
  assert.deepEqual(delivered, [[listener, 7]]);
  assert.equal(registry.stopListening('listener', source), listener);
  source.trigger('value', 8);
  assert.equal(delivered.length, 1);
  assert.equal(registry.stopListening('empty-listener'), registry.channel('empty-listener'));

  assert.throws(() => registry.reset('hooks'), error => error.code === 'MN0021');
  assert.equal(registry.triggerMethod('hooks', 'read:value', 3), undefined);
  const hooks = registry.channel('hooks');
  hooks.onReadValue = function(value) { assert.equal(this, hooks); return value * 2; };
  assert.equal(registry.triggerMethod('hooks', 'read:value', 3), 6);

  assert.throws(() => registry.reset('once'), error => error.code === 'MN0021');
  const once = registry.replyOnce('once', 'value', 9);
  assert.equal(once, registry.channel('once'));
  assert.equal(registry.request('once', 'value'), 9);
  assert.equal(registry.request('once', 'value'), undefined);
  registry.replyOnce('once', 'value', 10);
  assert.equal(registry.stopReplying('once', 'value'), once);
  assert.equal(registry.request('once', 'value'), undefined);
  assert.equal(registry.stopReplying('empty-replies'), registry.channel('empty-replies'));
  registry.reset();
  source.reset();
}
commonJSRadio.Radio.reset();
Radio.reset('preferences');
assert.equal(Radio.channel('preferences'), preferences);
assert.equal(preferences.request('theme'), undefined);
preferences.trigger('theme:changed', 'light');
assert.deepEqual(changes, ['dark']);
assert.throws(() => Radio.channel(''), error => error.code === 'MN0017');
assert.throws(() => Radio.reset('absent'), error => error.code === 'MN0021');
`,
  'packages-radio-2': `
assert.deepEqual(summary, { title: 'Release notes', count: 2 });
assert.equal(welcome, 'Welcome back');
assert.equal(repeatedWelcome, undefined);
catalog.reply('default', (name, ...args) => ({ name, args }));
assert.deepEqual(catalog.request('missing', 1), { name: 'missing', args: [1] });
assert.equal(catalog.request('title', 'a'), 'Overview');
const promise = Promise.resolve('ready');
catalog.reply('pending', promise);
assert.equal(catalog.request('pending'), promise);
assert.equal(catalog.request({ pending: undefined }).pending, promise);
const context = { label: 'Owned' };
function label() { return this.label; }
catalog.reply({ label }, context);
assert.equal(catalog.request('label'), 'Owned');
catalog.stopReplying(null, null, context);
assert.deepEqual(catalog.request('label'), { name: 'label', args: [] });
catalog.replyOnce('recursive', () => catalog.request('recursive'));
assert.deepEqual(catalog.request('recursive'), { name: 'recursive', args: [] });
catalog.replyOnce('failure', () => { throw new Error('failed'); });
assert.throws(() => catalog.request('failure'), /failed/);
assert.deepEqual(catalog.request('failure'), { name: 'failure', args: [] });
catalog.reset();
`,
  'packages-radio-3': `
assert.equal(previewTitle, 'Preview');
assert.equal(ready, true);
assert.equal(local.request('title'), undefined);
assert.equal(service.request('ready'), undefined);
assert.equal(service.on, undefined);
const { Radio } = await import('@mnjs/radio');
assert.equal(Channel, Radio.Channel);
assert.notEqual(local, Radio.channel('preview'));
local.reply('local', true);
Radio.reset();
assert.equal(local.request('local'), true);
const source = new Channel('source');
let calls = 0;
local.on('event', () => calls++);
local.listenTo(source, 'event', () => calls++);
assert.equal(local.reset(), local);
local.trigger('event');
source.trigger('event');
assert.equal(calls, 0);
source.reset();
`,
  'packages-radio-4': `
assert.deepEqual(activity, [
  { channel: 'settings', name: 'opened', args: [] },
  { channel: 'settings', name: 'missing', args: [] },
]);
assert.deepEqual(warnings, [
  { warning: 'An unhandled request was fired', name: 'missing', channel: 'settings' },
]);
radio.setDebug(false);
radio.trigger('settings', 'closed');
radio.request('settings', 'disabled');
assert.equal(activity.length, 2);
assert.equal(warnings.length, 1);
let receiver;
radio.log = function() { receiver = this; };
radio.tuneIn('settings');
radio.trigger('settings', 'reopened');
assert.equal(receiver, radio);
radio.tuneOut('settings');
radio.reset();
`,
  'packages-radio-5': `
assert.equal(theme, 'dark');
assert.equal(result, 'dark');
assert.equal(channel.reply('ready', true), channel);
assert.equal(radio.reply('settings', 'ready', false), channel);
assert.equal(channel.reset(), channel);
assert.equal(radio.reset(), undefined);
`,
};
