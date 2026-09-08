import { vi, describe, it, expect, afterEach } from 'vitest';
import Radio, { createRadio } from '../../packages/radio/src/radio.ts';
import { debugLog, setDebug } from '../../packages/radio/src/debug.ts';

describe('Radio', function() {
  afterEach(function() {
    Radio.setDebug(false);
    Radio.reset();
  });

  it('requires channel names', function() {
    expect(function() {
      Radio.channel();
    }).to.throw('You must provide a name for the channel.')
      .with.property('code', 'MN0017');
  });

  it('returns the same channel for a name', function() {
    expect(Radio.channel('foo')).to.equal(Radio.channel('foo'));
  });

  it('treats object prototype property names as ordinary channel names', function() {
    ['toString', 'constructor', '__proto__'].forEach(channelName => {
      const channel = Radio.channel(channelName);
      const handler = vi.fn();

      expect(channel.channelName).to.equal(channelName);
      expect(Radio.channel(channelName)).to.equal(channel);

      Radio.on(channelName, 'event', handler);
      Radio.trigger(channelName, 'event');

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  it('proxies events through the top-level API', function() {
    const handler = vi.fn();

    Radio.on('foo', 'bar', handler);
    Radio.trigger('foo', 'bar', 1);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls.map(args => args.slice(0, 1))).toContainEqual([1]);
  });

  it('requests channel replies through the top-level API', function() {
    const handler = vi.fn().mockReturnValue('baz');

    Radio.channel('foo').reply('bar', handler);

    expect(Radio.request('foo', 'bar')).to.equal('baz');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('forwards event and request methods through the top-level API', function() {
    const channel = Radio.channel('foo');
    expect(Radio.bind).to.be.undefined;
    expect(Radio.unbind).to.be.undefined;
    expect(channel.bind).to.be.undefined;
    expect(channel.unbind).to.be.undefined;

    const methods = [
      'on',
      'off',
      'once',
      'listenTo',
      'listenToOnce',
      'stopListening',
      'trigger',
      'triggerMethod',
      'reply',
      'replyOnce',
      'stopReplying',
      'request'
    ];

    methods.forEach(method => {
      const forwarded = vi.spyOn(channel, method).mockImplementation(() => undefined).mockReturnValue(method);

      expect(Radio[method]('foo', 'first', 'second')).to.equal(method);
      expect(forwarded).toHaveBeenCalledTimes(1);
      expect(forwarded.mock.contexts).toContain(channel);
      expect(forwarded).toHaveBeenCalledWith('first', 'second');
    });
  });

  it('exposes triggerMethod through Radio', function() {
    const channel = Radio.channel('foo');
    const handler = vi.fn();
    channel.onRequestComplete = vi.fn().mockReturnValue('complete');
    channel.on('request:complete', handler);

    expect(Radio.triggerMethod('foo', 'request:complete', 1)).to.equal('complete');
    expect(channel.onRequestComplete).toHaveBeenCalledTimes(1);
    expect(channel.onRequestComplete.mock.contexts).toContain(channel);
    expect(channel.onRequestComplete).toHaveBeenCalledWith(1);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(1);
  });

  it('debug logs overwritten requests when enabled', function() {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    Radio.setDebug();
    Radio.reply('foo', 'bar', 'baz');
    Radio.reply('foo', 'bar', 'qux');

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('supports request maps and space separated request names', function() {
    Radio.reply('foo', {
      'bar baz': function(value) {
        return `${value}:${this.channelName}`;
      }
    });

    expect(Radio.request('foo', 'bar baz', 'qux')).to.deep.equal({
      bar: 'qux:foo',
      baz: 'qux:foo'
    });
    expect(Radio.request('foo', { bar: 'one', baz: 'two' })).to.deep.equal({
      bar: 'one:foo',
      baz: 'two:foo'
    });
    expect(Radio.request('foo', { 'bar baz': 'qux' })).to.deep.equal({
      bar: 'qux:foo',
      baz: 'qux:foo'
    });
  });

  it('supports default request handlers', function() {
    const handler = vi.fn().mockReturnValue('default');
    Radio.reply('foo', 'default', handler);

    expect(Radio.request('foo', 'missing', 1, 2)).to.equal('default');
    expect(handler.mock.calls.map(args => args.slice(0, 3))).toContainEqual(['missing', 1, 2]);
  });

  it('supports replyOnce', function() {
    const handler = vi.fn().mockReturnValue('once');
    Radio.replyOnce('foo', 'bar', handler);

    expect(Radio.request('foo', 'bar')).to.equal('once');
    expect(Radio.request('foo', 'bar')).to.be.undefined;
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('stops replying by callback and context', function() {
    const context = {};
    const handler = vi.fn().mockReturnValue('bar');

    Radio.reply('foo', 'bar', handler, context);
    Radio.stopReplying('foo', 'bar', handler, {});
    expect(Radio.request('foo', 'bar')).to.equal('bar');

    Radio.stopReplying('foo', 'bar', handler, context);
    expect(Radio.request('foo', 'bar')).to.be.undefined;
  });

  it('leaves replies in place when stop filters do not match', function() {
    const handler = vi.fn().mockReturnValue('bar');
    const context = {};

    Radio.reply('foo', 'bar', handler, context);
    Radio.stopReplying('foo', 'missing');
    Radio.stopReplying('foo', 'bar', function() {});
    Radio.stopReplying('foo', 'bar', handler, {});

    expect(Radio.request('foo', 'bar')).to.equal('bar');
  });

  it('stops replies by callback across all names', function() {
    const handler = vi.fn().mockReturnValue('bar');

    Radio.reply('foo', 'bar baz', handler);
    Radio.stopReplying('foo', null, handler);

    expect(Radio.request('foo', 'bar')).to.be.undefined;
    expect(Radio.request('foo', 'baz')).to.be.undefined;
  });

  it('returns the channel when stopping replies before any are registered', function() {
    const channel = Radio.channel('foo');

    expect(channel.stopReplying('bar')).to.equal(channel);
  });

  it('clears replies when stopReplying is called without filters', function() {
    Radio.reply('foo', 'bar', 'baz');

    Radio.stopReplying('foo');

    expect(Radio.request('foo', 'bar')).to.be.undefined;
  });

  it('logs tuned in events and requests', function() {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    expect(Radio.tuneIn('foo')).to.equal(Radio);
    Radio.trigger('foo', 'bar', 1);
    Radio.reply('foo', 'baz', 'qux');
    Radio.request('foo', 'baz', 2);
    expect(Radio.tuneOut('foo')).to.equal(Radio);
    Radio.trigger('foo', 'bar', 3);

    expect(log).toHaveBeenCalledTimes(2);
  });

  it('logs channels named for object prototype properties', function() {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    ['toString', '__proto__'].forEach(channelName => {
      Radio.tuneIn(channelName);
      Radio.trigger(channelName, 'event');
      Radio.tuneOut(channelName);
    });

    expect(log).toHaveBeenCalledTimes(2);
  });

  it('debug logs unhandled requests when enabled', function() {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    Radio.setDebug();
    Radio.request('foo', 'missing');
    Radio.setDebug(false);
    Radio.request('foo', 'missing');

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('formats direct debug logs without a channel name', function() {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    setDebug();
    debugLog('warning', 'event');
    setDebug(false);

    expect(warn.mock.calls.map(args => args.slice(0, 1))).toContainEqual(['warning: "event"']);
  });

  it('resets a named channel and all channels', function() {
    const fooHandler = vi.fn();
    const barHandler = vi.fn();

    Radio.on('foo', 'event', fooHandler);
    Radio.on('bar', 'event', barHandler);
    Radio.reset('foo');
    Radio.trigger('foo', 'event');
    Radio.trigger('bar', 'event');
    expect(fooHandler).not.toHaveBeenCalled();
    expect(barHandler).toHaveBeenCalledTimes(1);

    Radio.reset();
    Radio.trigger('bar', 'event');
    expect(barHandler).toHaveBeenCalledTimes(1);
  });

  it('rejects an unknown named channel without changing existing channels', function() {
    const handler = vi.fn();
    Radio.on('existing', 'event', handler);

    expect(() => Radio.reset('missing'))
      .to.throw('Radio channel does not exist.')
      .with.property('code', 'MN0021');

    Radio.trigger('existing', 'event');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown prototype property channel names and resets them once created', function() {
    const IsolatedRadio = createRadio();

    ['toString', 'constructor', '__proto__'].forEach(channelName => {
      expect(() => IsolatedRadio.reset(channelName)).to.throw().with.property('code', 'MN0021');

      const channel = IsolatedRadio.channel(channelName);
      const handler = vi.fn();
      channel.on('event', handler);

      IsolatedRadio.reset(channelName);

      expect(IsolatedRadio.channel(channelName)).to.equal(channel);
      channel.trigger('event');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  it('resets channels through the same property lookup used to create them', function() {
    const name = { toString() { return 'coerced-channel'; } };
    const channel = Radio.channel(name);
    const handler = vi.fn();
    channel.on('event', handler);
    Radio.reset(name);
    channel.trigger('event');
    expect(handler).not.toHaveBeenCalled();
    expect(Radio.channel('coerced-channel')).to.equal(channel);
  });

  it('rejects a supplied falsy channel name without resetting existing channels', function() {
    const handler = vi.fn();
    Radio.on('existing', 'event', handler);

    ['', null, false, 0, undefined].forEach(channelName => {
      expect(() => Radio.reset(channelName)).to.throw().with.property('code', 'MN0017');
    });

    Radio.trigger('existing', 'event');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('resets all prototype-named channels only when called without arguments', function() {
    const handlers = ['toString', '__proto__'].map(channelName => {
      const handler = vi.fn();
      Radio.on(channelName, 'event', handler);
      return [channelName, handler];
    });

    Radio.reset();

    handlers.forEach(([channelName, handler]) => {
      Radio.trigger(channelName, 'event');
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
