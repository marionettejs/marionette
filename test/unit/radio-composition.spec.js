import Radio from '../../src/modules/radio';
import { setDebug } from '../../src/modules/common/radio';
import Events from '../../src/mixins/events';
import Requests from '../../src/mixins/requests';

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

  it('exposes one singleton API and keeps implementation seams private', function() {
    const channel = Radio.channel('composition');
    const channelPrototype = Object.getPrototypeOf(channel);
    const channelFinal = { reset: channelPrototype.reset };
    const expectedChannelKeys = composedKeys(Events, Requests, channelFinal);

    expect(Object.getOwnPropertyDescriptor(Radio, 'setDebug'))
      .to.deep.equal(assignmentDescriptor(setDebug));
    expect(Radio).to.not.have.any.keys('Channel', 'log', 'debugLog', '_channels');
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
    const forwarded = this.sinon.stub(channel, 'on').returns('result');
    const receiver = { channel: this.sinon.stub() };

    expect(Radio.on.call(receiver, 'singleton-forwarding', 'first', 'second'))
      .to.equal('result');
    expect(receiver.channel).to.not.have.been.called;
    expect(forwarded)
      .to.have.been.calledOnce
      .and.calledOn(channel)
      .and.calledWithExactly('first', 'second');
  });

  it('resets the singleton registry when reset is borrowed', function() {
    const handler = this.sinon.stub();
    const alternateReset = this.sinon.stub();

    Radio.on('singleton-reset', 'event', handler);
    expect(Radio.reset.call({ _channels: { alternate: { reset: alternateReset } } }))
      .to.be.undefined;
    Radio.trigger('singleton-reset', 'event');

    expect(handler).to.not.have.been.called;
    expect(alternateReset).to.not.have.been.called;
  });

  it('excludes inherited API pollution and safely composes own built-in keys', async function() {
    const eventsPrototype = Object.getPrototypeOf(Events);
    const descriptors = new Map(
      ['constructor', 'toString', '__proto__']
        .map(key => [key, Object.getOwnPropertyDescriptor(Events, key)])
    );
    const methods = {
      constructor() {},
      toString() {},
      __proto__() {}
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

      ({ default: IsolatedRadio } = await import('../../src/modules/radio.ts?composition-test'));
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
