import { vi, describe, it, expect, beforeEach } from 'vitest';
import { bindRequests, unbindRequests } from '@marionette/utils';
import { Radio as Radio } from '@marionette/radio';

const acceptedBindingMaps = [
  {},
  [],
  function() {},
  async function() {},
  function*() {},
  class {},
  new Boolean(false),
  new Number(0),
  new String(''),
  new Proxy({}, {})
];

const falsyBindingMaps = [undefined, null, false, 0, 0n, '', NaN];

describe('bind-requests', function() {
  let channel;
  let target;

  beforeEach(function() {
    channel = {
      reply: vi.fn(),
      stopReplying: vi.fn()
    };

    target = {
      replyFoo: vi.fn(),
      bindRequests,
      unbindRequests
    };

    vi.spyOn(target, 'bindRequests');
    vi.spyOn(target, 'unbindRequests')
  });

  describe('bindRequests', function() {
    describe('when channel isnt passed', function() {
      beforeEach(function() {
        target.bindRequests(false, { 'foo': 'replyFoo' });
      });

      it('shouldnt bind any requests', function() {
        expect(channel.reply).not.toHaveBeenCalled();
      });

      it('should return the target', function() {
        expect(target.bindRequests).toHaveReturnedWith(target);
      });
    });

    describe('when bindings isnt passed', function() {
      beforeEach(function() {
        target.bindRequests(channel, null);
      });

      it('shouldnt bind any requests', function() {
        expect(channel.reply).not.toHaveBeenCalled();
      });

      it('should return the target', function() {
        expect(target.bindRequests).toHaveReturnedWith(target);
      });
    });

    it('preserves accepted object and function binding maps', function() {
      for (const bindings of acceptedBindingMaps) {
        expect(target.bindRequests(channel, bindings)).to.equal(target);
        expect(channel.reply).toHaveBeenCalledTimes(1);
        channel.reply.mockClear();
      }
    });

    it('preserves the falsy binding-map early return', function() {
      for (const bindings of falsyBindingMaps) {
        expect(target.bindRequests(channel, bindings)).to.equal(target);
      }

      expect(channel.reply).not.toHaveBeenCalled();
    });

    describe('when bindings is an object with an event handler hash', function() {
      it('should return the target', function() {
        target.bindRequests(channel, { 'foo': 'replyFoo' })
        expect(target.bindRequests).toHaveReturnedWith(target);
      });

      describe('when handler is a function', function() {
        it('should bind a request to targets handler', function() {
          const replyBar = vi.fn();
          target.bindRequests(channel, { 'bar': replyBar });
          expect(channel.reply).toHaveBeenCalledTimes(1);
          expect(channel.reply.mock.calls.map(args => args.slice(0, 2))).toContainEqual([{ 'bar': replyBar }, target]);
        });
      });

      describe('when handler is a string', function() {
        describe('when one handler is passed', function() {
          it('should bind a request to targets handler', function() {
            target.bindRequests(channel, { 'foo': 'replyFoo' });
            expect(channel.reply).toHaveBeenCalledTimes(1);
            expect(channel.reply.mock.calls.map(args => args.slice(0, 2))).toContainEqual([{ 'foo': target.replyFoo }, target]);
          });
        });
      });
    });

  });

  describe('unbindRequests', function() {
    it('removes only the current owner\'s replies without a binding map', function() {
      const realChannel = Radio.channel('owner-scoped-unbind-all');
      const firstOwner = {
        name: 'first',
        bindRequests,
        unbindRequests
      };
      const secondOwner = {
        name: 'second',
        bindRequests,
        unbindRequests
      };
      const replyWithOwner = function() {
        return this.name;
      };

      firstOwner.bindRequests(realChannel, { first: replyWithOwner });
      secondOwner.bindRequests(realChannel, { second: replyWithOwner });
      realChannel.reply('direct', () => 'direct');

      firstOwner.unbindRequests(realChannel);

      expect(realChannel.request('first')).to.be.undefined;
      expect(realChannel.request('second')).to.equal('second');
      expect(realChannel.request('direct')).to.equal('direct');
    });

    it('selectively removes caller-owned replies without disturbing other replies', function() {
      const realChannel = Radio.channel('owner-scoped-selective-unbind');
      const sharedReply = function() {
        return this.name;
      };
      const firstOwner = {
        name: 'first',
        bindRequests,
        unbindRequests
      };
      const secondOwner = {
        name: 'second',
        bindRequests,
        unbindRequests
      };
      const firstBindings = {
        keep: sharedReply,
        remove: sharedReply,
        replaced: sharedReply
      };

      firstOwner.bindRequests(realChannel, firstBindings);
      secondOwner.bindRequests(realChannel, { replaced: sharedReply });
      firstOwner.unbindRequests(realChannel, {
        remove: sharedReply,
        replaced: sharedReply
      });

      expect(realChannel.request('remove')).to.be.undefined;
      expect(realChannel.request('keep')).to.equal('first');
      expect(realChannel.request('replaced')).to.equal('second');
    });

    describe('when channel isnt passed', function() {
      beforeEach(function() {
        target.unbindRequests(false, { 'foo': 'replyFoo' });
      });

      it('shouldnt unbind any request', function() {
        expect(channel.stopReplying).not.toHaveBeenCalled();
      });

      it('should return the target', function() {
        expect(target.unbindRequests).toHaveReturnedWith(target);
      });
    });

    describe('when bindings isnt passed', function() {
      beforeEach(function() {
        target.unbindRequests(channel, null);
      });

      it('should unbind all requests', function() {
        expect(channel.stopReplying).toHaveBeenCalledTimes(1);
        expect(channel.stopReplying.mock.calls.map(args => args.slice(0, 3))).toContainEqual([null, null, target]);
      });

      it('should return the target', function() {
        expect(target.unbindRequests).toHaveReturnedWith(target);
      });
    });

    it('preserves accepted object and function binding maps', function() {
      for (const bindings of acceptedBindingMaps) {
        expect(target.unbindRequests(channel, bindings)).to.equal(target);
        expect(channel.stopReplying).toHaveBeenCalledTimes(1);
        channel.stopReplying.mockClear();
      }
    });

    it('preserves the falsy binding-map unbind-all path', function() {
      for (const bindings of falsyBindingMaps) {
        expect(target.unbindRequests(channel, bindings)).to.equal(target);
        expect(channel.stopReplying).toHaveBeenCalledTimes(1);
        expect(channel.stopReplying.mock.calls.map(args => args.slice(0, 3))).toContainEqual([null, null, target]);
        channel.stopReplying.mockClear();
      }
    });

    describe('when bindings is an object with an event handler hash', function() {
      it('should return the target', function() {
        target.unbindRequests(channel, { 'foo': 'replyFoo' });
        expect(target.unbindRequests).toHaveReturnedWith(target);
      });

      describe('when handler is a function', function() {
        it('should unbind an request', function() {
          const replyBar = vi.fn();
          target.unbindRequests(channel, { 'bar': replyBar })
          expect(channel.stopReplying).toHaveBeenCalledTimes(1);
          expect(channel.stopReplying.mock.calls.map(args => args.slice(0, 2))).toContainEqual([{ 'bar': replyBar }, target]);
        });
      });

      describe('when handler is a string', function() {
        describe('when one handler is passed', function() {
          it('should unbind an request', function() {
            target.unbindRequests(channel, { 'foo': 'replyFoo' });
            expect(channel.stopReplying).toHaveBeenCalledTimes(1);
            expect(channel.stopReplying.mock.calls.map(args => args.slice(0, 2))).toContainEqual([{ 'foo': target.replyFoo }, target]);
          });
        });
      });
    });

  });
});
