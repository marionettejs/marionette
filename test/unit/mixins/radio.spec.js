import { vi, describe, it, expect, beforeEach } from 'vitest';
import _ from 'underscore';
import Events from '../../../packages/utils/src/events.ts';
import Radio from '../../../packages/radio/src/radio.ts';
import RadioMixin from '../../../src/mixins/radio';

describe('Radio Mixin on Marionette.Object', function() {
  let radioObject;
  let channelFoo;

  beforeEach(function() {
    radioObject = _.extend({
      // Simulate implementation
      initialize() {
        this._initRadio();
      },
      bindEvents: vi.fn(),
      bindRequests: vi.fn(),
    }, Events, RadioMixin);

    channelFoo = Radio.channel('foo');
  });

  describe('when a channelName is not defined', function() {
    beforeEach(function() {
      radioObject.initialize();
    });

    it('should not have a Radio channel', function() {
      expect(radioObject.getChannel()).to.be.undefined;
    });

    it('should not bind radioEvents', function() {
      expect(radioObject.bindEvents).not.toHaveBeenCalled();
    });

    it('should not bind radioRequests', function() {
      expect(radioObject.bindRequests).not.toHaveBeenCalled();
    });

    it('does not read radio bindings after a falsy channel name', function() {
      const channelName = vi.fn();
      const radioEvents = vi.fn().mockImplementation(() => { throw new Error('must not read events'); });
      const radioRequests = vi.fn().mockImplementation(() => { throw new Error('must not read requests'); });
      Object.defineProperties(radioObject, {
        channelName: { get: channelName, enumerable: true },
        radioEvents: { get: radioEvents, enumerable: true },
        radioRequests: { get: radioRequests, enumerable: true }
      });

      [undefined, null, false, 0, ''].forEach(value => {
        channelName.mockReturnValue(value);
        radioObject.initialize();
      });

      expect(channelName).toHaveBeenCalledTimes(5);
      expect(radioEvents).not.toHaveBeenCalled();
      expect(radioRequests).not.toHaveBeenCalled();
    });
  });

  describe('when a channelName is defined', function() {
    describe('on the object', function() {
      it('should have the named Radio channel', function() {
        radioObject.channelName = 'foo';
        radioObject.initialize();

        expect(radioObject.getChannel()).to.eql(channelFoo);
      });
    });

    describe('as a function', function() {
      it('should have the named Radio channel', function() {
        radioObject.channelName = vi.fn().mockReturnValue('foo');
        radioObject.initialize();

        expect(radioObject.getChannel()).to.eql(channelFoo);
      });
    });
  });

  describe('when a radioEvents is defined', function() {
    beforeEach(function() {
      radioObject.channelName = 'foo';
    });

    describe('on the object', function() {
      it('should bind events to the channel', function() {
        radioObject.radioEvents = {'bar': 'onBar'};
        radioObject.initialize();

        expect(radioObject.bindEvents).toHaveBeenCalledTimes(1);
        expect(radioObject.bindEvents.mock.calls.map(args => args.slice(0, 2))).toContainEqual([channelFoo, {'bar': 'onBar'}]);
      });
    });

    describe('as a function', function() {
      it('should bind events to the channel', function() {
        radioObject.radioEvents = vi.fn().mockReturnValue({'bar': 'onBar'});
        radioObject.initialize();

        expect(radioObject.bindEvents).toHaveBeenCalledTimes(1);
        expect(radioObject.bindEvents.mock.calls.map(args => args.slice(0, 2))).toContainEqual([channelFoo, {'bar': 'onBar'}]);
      });
    });
  });

  describe('when a radioRequests is defined', function() {
    beforeEach(function() {
      radioObject.channelName = 'foo';
    });

    describe('on the object', function() {
      it('should bind requests to the channel', function() {
        radioObject.radioRequests = {'baz': 'getBaz'};
        radioObject.initialize();

        expect(radioObject.bindRequests).toHaveBeenCalledTimes(1);
        expect(radioObject.bindRequests.mock.calls.map(args => args.slice(0, 2))).toContainEqual([channelFoo, {'baz': 'getBaz'}]);
      });
    });

    describe('as a function', function() {
      it('should bind requests to the channel', function() {
        radioObject.radioRequests = vi.fn().mockReturnValue({'baz': 'getBaz'});
        radioObject.initialize();

        expect(radioObject.bindRequests).toHaveBeenCalledTimes(1);
        expect(radioObject.bindRequests.mock.calls.map(args => args.slice(0, 2))).toContainEqual([channelFoo, {'baz': 'getBaz'}]);
      });
    });
  });

  it('resolves and binds radio options in order', function() {
    const calls = [];
    radioObject.channelName = vi.fn().mockImplementation(function(...args) {
      calls.push(['channelName', this === radioObject, args.length]);
      return 'foo';
    });
    radioObject.radioEvents = vi.fn().mockImplementation(function(...args) {
      calls.push(['radioEvents', this === radioObject, args.length]);
      return { bar: 'onBar' };
    });
    radioObject.radioRequests = vi.fn().mockImplementation(function(...args) {
      calls.push(['radioRequests', this === radioObject, args.length]);
      return { baz: 'getBaz' };
    });
    radioObject.bindEvents.mockImplementation(() => calls.push(['bindEvents']));
    radioObject.bindRequests.mockImplementation(() => calls.push(['bindRequests']));
    vi.spyOn(Radio, 'channel').mockImplementation(() => undefined).mockImplementation(channelName => {
      calls.push(['channel', channelName]);
      return channelFoo;
    });
    radioObject.initialize();

    expect(calls).to.deep.equal([
      ['channelName', true, 0],
      ['channel', 'foo'],
      ['radioEvents', true, 0],
      ['bindEvents'],
      ['radioRequests', true, 0],
      ['bindRequests']
    ]);
    [radioObject.channelName, radioObject.radioEvents, radioObject.radioRequests]
      .forEach(option => {
        expect(option).toHaveBeenCalledTimes(1);
        expect(option.mock.contexts).toContain(radioObject);
        expect(option).toHaveBeenCalledWith();
      });
  });

  it('propagates a radio option lookup error before later work', function() {
    const error = new Error('radioEvents failed');
    const radioRequests = vi.fn().mockReturnValue({ baz: 'getBaz' });
    radioObject.channelName = 'foo';
    Object.defineProperty(radioObject, 'radioEvents', {
      get() {
        throw error;
      }
    });
    radioObject.radioRequests = radioRequests;
    expect(() => radioObject.initialize()).to.throw(error);
    expect(radioObject.bindEvents).not.toHaveBeenCalled();
    expect(radioRequests).not.toHaveBeenCalled();
    expect(radioObject.bindRequests).not.toHaveBeenCalled();
  });

  describe('when an owner destroys its Radio resources', function() {
    let fooChannel;

    beforeEach(function() {
      radioObject.channelName = 'foo'
      radioObject.initialize();

      fooChannel = radioObject.getChannel();

      vi.spyOn(fooChannel, 'stopReplying');

      radioObject._destroyRadio();
    });

    it('should stopReplying to the object', function() {
      expect(fooChannel.stopReplying).toHaveBeenCalledTimes(1);
      expect(fooChannel.stopReplying.mock.calls.map(args => args.slice(0, 3))).toContainEqual([null, null, radioObject]);
    });
  });
});
