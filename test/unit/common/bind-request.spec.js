import { bindRequests, unbindRequests } from '../../../src/modules/common/bind-requests';
import Radio from '../../../src/modules/radio';

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

const rejectedBindingMaps = [true, 1, 1n, 'replyFoo', Symbol('bindings')];

const falsyBindingMaps = [undefined, null, false, 0, 0n, '', NaN];

describe('bind-requests', function() {
  let channel;
  let target;

  beforeEach(function() {
    channel = {
      reply: this.sinon.stub(),
      stopReplying: this.sinon.stub()
    };

    target = {
      replyFoo: this.sinon.stub(),
      bindRequests,
      unbindRequests
    };

    this.sinon.spy(target, 'bindRequests');
    this.sinon.spy(target, 'unbindRequests')
  });

  describe('bindRequests', function() {
    describe('when channel isnt passed', function() {
      beforeEach(function() {
        target.bindRequests(false, { 'foo': 'replyFoo' });
      });

      it('shouldnt bind any requests', function() {
        expect(channel.reply).not.to.have.been.called;
      });

      it('should return the target', function() {
        expect(target.bindRequests).to.have.returned(target);
      });
    });

    describe('when bindings isnt passed', function() {
      beforeEach(function() {
        target.bindRequests(channel, null);
      });

      it('shouldnt bind any requests', function() {
        expect(channel.reply).not.to.have.been.called;
      });

      it('should return the target', function() {
        expect(target.bindRequests).to.have.returned(target);
      });
    });

    it('preserves accepted object and function binding maps', function() {
      for (const bindings of acceptedBindingMaps) {
        expect(target.bindRequests(channel, bindings)).to.equal(target);
        expect(channel.reply).to.have.been.calledOnce;
        channel.reply.resetHistory();
      }
    });

    it('preserves the falsy binding-map early return', function() {
      for (const bindings of falsyBindingMaps) {
        expect(target.bindRequests(channel, bindings)).to.equal(target);
      }

      expect(channel.reply).to.not.have.been.called;
    });

    describe('when bindings is an object with an event handler hash', function() {
      it('should return the target', function() {
        target.bindRequests(channel, { 'foo': 'replyFoo' })
        expect(target.bindRequests).to.have.returned(target);
      });

      describe('when handler is a function', function() {
        it('should bind a request to targets handler', function() {
          const replyBar = this.sinon.stub();
          target.bindRequests(channel, { 'bar': replyBar });
          expect(channel.reply)
            .to.have.been.calledOnce
            .and.calledWith({ 'bar': replyBar }, target);
        });
      });

      describe('when handler is a string', function() {
        describe('when one handler is passed', function() {
          it('should bind a request to targets handler', function() {
            target.bindRequests(channel, { 'foo': 'replyFoo' });
            expect(channel.reply)
              .to.have.been.calledOnce
              .and.calledWith({ 'foo': target.replyFoo }, target);
          });
        });
      });
    });

    describe('when bindings is not an object', function() {
      it('rejects truthy primitives before replying', function() {
        for (const bindings of rejectedBindingMaps) {
          const bind = target.bindRequests.bind(target, channel, bindings);
          expect(bind)
            .to.throw('Bindings must be an object.')
            .with.property('code', 'MN0010');
        }

        expect(channel.reply).to.not.have.been.called;
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
        expect(channel.stopReplying).not.to.have.been.called;
      });

      it('should return the target', function() {
        expect(target.unbindRequests).to.have.returned(target);
      });
    });

    describe('when bindings isnt passed', function() {
      beforeEach(function() {
        target.unbindRequests(channel, null);
      });

      it('should unbind all requests', function() {
        expect(channel.stopReplying)
          .to.have.been.calledOnce
          .and.calledWith(null, null, target);
      });

      it('should return the target', function() {
        expect(target.unbindRequests).to.have.returned(target);
      });
    });

    it('preserves accepted object and function binding maps', function() {
      for (const bindings of acceptedBindingMaps) {
        expect(target.unbindRequests(channel, bindings)).to.equal(target);
        expect(channel.stopReplying).to.have.been.calledOnce;
        channel.stopReplying.resetHistory();
      }
    });

    it('preserves the falsy binding-map unbind-all path', function() {
      for (const bindings of falsyBindingMaps) {
        expect(target.unbindRequests(channel, bindings)).to.equal(target);
        expect(channel.stopReplying)
          .to.have.been.calledOnce
          .and.calledWith(null, null, target);
        channel.stopReplying.resetHistory();
      }
    });

    describe('when bindings is an object with an event handler hash', function() {
      it('should return the target', function() {
        target.unbindRequests(channel, { 'foo': 'replyFoo' });
        expect(target.unbindRequests).to.have.returned(target);
      });

      describe('when handler is a function', function() {
        it('should unbind an request', function() {
          const replyBar = this.sinon.stub();
          target.unbindRequests(channel, { 'bar': replyBar })
          expect(channel.stopReplying)
            .to.have.been.calledOnce
            .and.calledWith({ 'bar': replyBar }, target);
        });
      });

      describe('when handler is a string', function() {
        describe('when one handler is passed', function() {
          it('should unbind an request', function() {
            target.unbindRequests(channel, { 'foo': 'replyFoo' });
            expect(channel.stopReplying)
              .to.have.been.calledOnce
              .and.calledWith({ 'foo': target.replyFoo }, target);
          });
        });
      });
    });

    describe('when bindings is not an object', function() {
      it('rejects truthy primitives before selectively stopping replies', function() {
        for (const bindings of rejectedBindingMaps) {
          const unbind = target.unbindRequests.bind(target, channel, bindings);
          expect(unbind)
            .to.throw('Bindings must be an object.')
            .with.property('code', 'MN0010');
        }

        expect(channel.stopReplying).to.not.have.been.called;
      });
    });
  });
});
