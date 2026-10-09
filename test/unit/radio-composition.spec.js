import { vi, describe, it, expect, afterEach } from 'vitest';
import { Radio, createRadio } from '@mnjs/radio';
import { Events } from '@mnjs/utils';
import { Requests as Requests } from '@mnjs/radio';

function assignmentDescriptor(value) {
  return {
    configurable: true,
    enumerable: true,
    value,
    writable: true
  };
}

function composedKeys(...sources) {
  const keys = [];
  sources.forEach(source => {
    Object.keys(source).forEach(key => {
      if (!keys.includes(key)) { keys.push(key); }
    });
  });
  return keys;
}

describe('Radio composition', function() {
  afterEach(function() {
    Radio.reset();
  });

  it('exposes messaging APIs and keeps the channel registry private', function() {
    const channel = Radio.channel('composition');
    const channelPrototype = Object.getPrototypeOf(channel);
    const channelFinal = { reset: channelPrototype.reset };
    const expectedChannelKeys = composedKeys(Events, Requests, channelFinal);

    expect(Object.getOwnPropertyDescriptor(Radio, 'setDebug'))
      .to.deep.equal(assignmentDescriptor(Radio.setDebug));
    expect(Radio.Channel.prototype).to.equal(channelPrototype);
    expect(Radio.log).to.be.a('function');
    expect(Radio.debugLog).to.be.a('function');
    expect(Object.keys(channelPrototype)).to.deep.equal(expectedChannelKeys);

    [Events, Requests].forEach(source => {
      Object.keys(source).forEach(key => {
        expect(Object.getOwnPropertyDescriptor(channelPrototype, key))
          .to.deep.equal(assignmentDescriptor(source[key]));
        expect(Object.getOwnPropertyDescriptor(Radio, key))
          .to.deep.equal(assignmentDescriptor(Radio[key]));
      });
    });
  });

  it('forwards through the singleton when a top-level method is borrowed', function() {
    const channel = Radio.channel('singleton-forwarding');
    const forwarded = vi.spyOn(channel, 'on').mockImplementation(() => undefined).mockReturnValue('result');
    const receiver = { channel: vi.fn() };

    expect(Radio.on.call(receiver, 'singleton-forwarding', 'first', 'second'))
      .to.equal('result');
    expect(receiver.channel).not.toHaveBeenCalled();
    expect(forwarded).toHaveBeenCalledTimes(1);
    expect(forwarded.mock.contexts).toContain(channel);
    expect(forwarded).toHaveBeenCalledWith('first', 'second');
  });

  it('resets the singleton registry when reset is borrowed', function() {
    const handler = vi.fn();
    const alternateReset = vi.fn();

    Radio.on('singleton-reset', 'event', handler);
    expect(Radio.reset.call({ channel: () => ({ reset: alternateReset }) }))
      .toBeUndefined();
    Radio.trigger('singleton-reset', 'event');

    expect(handler).not.toHaveBeenCalled();
    expect(alternateReset).not.toHaveBeenCalled();
  });

  it('excludes inherited API pollution and safely composes own built-in keys', function() {
    const eventsPrototype = Object.getPrototypeOf(Events);
    const descriptors = new Map(
      ['constructor', 'toString']
        .map(key => [key, Object.getOwnPropertyDescriptor(Events, key)])
    );
    const methods = {
      constructor() {},
      toString() {}
    };
    const cleanup = [];
    let IsolatedRadio;
    let primaryError;

    try {
      const pollutedPrototype = {};
      Object.defineProperty(pollutedPrototype, 'inheritedApi', {
        enumerable: true,
        get() {
          throw new Error('inherited API was read');
        }
      });
      Object.setPrototypeOf(Events, pollutedPrototype);
      cleanup.push(() => Object.setPrototypeOf(Events, eventsPrototype));
      Object.entries(methods).forEach(([key, value]) => {
        Object.defineProperty(Events, key, assignmentDescriptor(value));
        cleanup.push(() => {
          const descriptor = descriptors.get(key);
          if (descriptor) {
            Object.defineProperty(Events, key, descriptor);
          } else if (!Reflect.deleteProperty(Events, key)) {
            throw new Error(`Unable to restore Events.${key}`);
          }
        });
      });

      IsolatedRadio = createRadio();
    } catch (error) {
      primaryError = error;
    }

    let cleanupError;
    for (let index = cleanup.length - 1; index >= 0; index--) {
      try {
        cleanup[index]();
      } catch (error) {
        cleanupError = cleanupError || error;
      }
    }

    if (primaryError) { throw primaryError; }
    if (cleanupError) { throw cleanupError; }

    const isolatedChannel = IsolatedRadio.channel('composition');
    const channelPrototype = Object.getPrototypeOf(isolatedChannel);

    expect(IsolatedRadio).to.not.equal(Radio);
    expect(IsolatedRadio).to.not.have.own.property('inheritedApi');
    expect(channelPrototype).to.not.have.own.property('inheritedApi');
    expect(Object.getPrototypeOf(IsolatedRadio)).to.equal(Object.prototype);
    expect(Object.getPrototypeOf(channelPrototype)).to.equal(Object.prototype);
    Object.entries(methods).forEach(([key, value]) => {
      const channelDescriptor = assignmentDescriptor(value);
      if (key === 'constructor') { channelDescriptor.enumerable = false; }
      expect(Object.getOwnPropertyDescriptor(channelPrototype, key))
        .to.deep.equal(channelDescriptor);
      expect(Object.getOwnPropertyDescriptor(IsolatedRadio, key))
        .to.deep.equal(assignmentDescriptor(IsolatedRadio[key]));
    });
  });
});
