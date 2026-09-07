import { createRequire } from 'node:module';
import { createRadio } from '../../packages/radio/src/index.ts';

const require = createRequire(import.meta.url);
const BackboneRadio = require('backbone.radio');

// Compare public behavior against the published Backbone.Radio 2.0.0 runtime.
// API removals and deliberate v5 differences are documented in docs/radio.md.
const scenarios = {
  'named handlers take precedence over the default handler'(radio) {
    const channel = radio.channel('parity');
    channel.reply('default', (...args) => ['fallback', ...args]);
    channel.reply('named', (...args) => ['named', ...args]);
    return [channel.request('named', 1, 2, 3, 4), channel.request('missing', 5, 6)];
  },
  'flat reply values retain identity and suppress fallback'(radio) {
    const channel = radio.channel('parity');
    const value = {};
    channel.reply('default', 'fallback');
    channel.reply('value', value);
    channel.reply('empty', undefined);
    channel.reply('false', false);
    return [channel.request('value') === value, channel.request('empty'), channel.request('false')];
  },
  'reply maps preserve callback context and mapped request arguments'(radio) {
    const channel = radio.channel('parity');
    const context = { label: 'context' };
    function reply(...args) { return [this.label, ...args]; }
    channel.reply({ first: reply, second: reply }, context);
    return channel.request({ first: 1, second: 2 }, 3);
  },
  'space-separated and nested requests flatten results in call order'(radio) {
    const channel = radio.channel('parity');
    channel.reply('first second', (...args) => args);
    return [channel.request('first second', 1), channel.request({ 'first second': 2, first: 3 }, 4)];
  },
  'replyOnce falls back after the first invocation'(radio) {
    const channel = radio.channel('parity');
    channel.reply('default', (...args) => args);
    channel.replyOnce('once', 'first');
    return [channel.request('once'), channel.request('once', 'second')];
  },
  'replyOnce unregisters before a recursive request'(radio) {
    const channel = radio.channel('parity');
    channel.reply('default', 'fallback');
    channel.replyOnce('once', () => ['first', channel.request('once')]);
    return channel.request('once');
  },
  'replyOnce allows its callback to install a replacement'(radio) {
    const channel = radio.channel('parity');
    channel.replyOnce('once', () => { channel.reply('once', 'replacement'); return 'first'; });
    return [channel.request('once'), channel.request('once')];
  },
  'a throwing once handler remains removed'(radio) {
    const channel = radio.channel('parity');
    channel.replyOnce('once', () => { throw new Error('handler failed'); });
    let message;
    try { channel.request('once'); } catch (error) { message = error.message; }
    return [message, channel.request('once')];
  },
  'stopReplying filters by callback and context together'(radio) {
    const channel = radio.channel('parity');
    const first = {}; const second = {};
    const callback = () => 'shared';
    channel.reply('one two', callback, first);
    channel.reply('three', callback, second);
    channel.reply('four', () => 'other', first);
    channel.stopReplying(undefined, callback, first);
    return channel.request('one two three four');
  },
  'stopReplying maps and space-separated names remove only selected replies'(radio) {
    const channel = radio.channel('parity');
    const callback = () => 'value';
    channel.reply('one two three four', callback);
    channel.stopReplying({ one: callback });
    channel.stopReplying('two three');
    return channel.request('one two three four');
  },
  'channel reset removes events, owned listeners, and replies'(radio) {
    const channel = radio.channel('parity');
    const other = radio.channel('other');
    const calls = [];
    channel.on('event', () => calls.push('own'));
    channel.listenTo(other, 'event', () => calls.push('other'));
    channel.reply('value', 'reply');
    const same = channel.reset() === channel;
    channel.trigger('event');
    other.trigger('event');
    return [same, calls, channel.request('value')];
  },
  'named reset preserves channel identity and other channels'(radio) {
    const first = radio.channel('parity'); const second = radio.channel('other');
    first.reply('value', 'first');
    second.reply('value', 'second');
    radio.reset('parity');
    return [radio.channel('parity') === first, first.request('value'), second.request('value')];
  },
  'top-level methods forward context, arguments, and channel return values'(radio) {
    const channel = radio.channel('parity');
    const calls = [];
    const returned = radio.on('parity', 'event', function(...args) { calls.push([this === channel, ...args]); });
    radio.trigger('parity', 'event', 1, 2);
    const replied = radio.reply('parity', 'value', 3);
    return [returned === channel, replied === channel, calls, radio.request('parity', 'value')];
  },
  'listenToOnce and stopListening preserve listener ownership'(radio) {
    const owner = radio.channel('parity'); const source = radio.channel('other');
    const calls = [];
    owner.listenToOnce(source, 'event', () => calls.push('once'));
    source.trigger('event');
    source.trigger('event');
    owner.listenTo(source, 'event', () => calls.push('persistent'));
    owner.stopListening(source);
    source.trigger('event');
    return calls;
  }
};

describe('Radio parity with Backbone.Radio 2.0.0', function() {
  for (const [name, scenario] of Object.entries(scenarios)) {
    it(name, function() {
      BackboneRadio.reset();
      try {
        expect(scenario(createRadio())).to.deep.equal(scenario(BackboneRadio));
      } finally {
        BackboneRadio.reset();
      }
    });
  }
});

describe('Radio differences from published Backbone.Radio 2.0.0', function() {
  it('removes a once reply by its original callback', function() {
    function cancel(radio) {
      const channel = radio.channel('cancel-once');
      const callback = () => 'once';
      channel.replyOnce('once', callback);
      channel.stopReplying('once', callback);
      return channel.request('once');
    }
    BackboneRadio.reset();
    try {
      expect(cancel(BackboneRadio)).to.equal('once');
      expect(cancel(createRadio())).to.be.undefined;
    } finally {
      BackboneRadio.reset();
    }
  });
});
