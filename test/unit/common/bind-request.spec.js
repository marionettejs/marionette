import { bindRequests, unbindRequests } from '../../../src/common/bind-requests';

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
            .and.calledWith({ 'bar': replyBar });
        });
      });

      describe('when handler is a string', function() {
        describe('when one handler is passed', function() {
          it('should bind a request to targets handler', function() {
            target.bindRequests(channel, { 'foo': 'replyFoo' });
            expect(channel.reply)
              .to.have.been.calledOnce
              .and.calledWith({ 'foo': target.replyFoo });
          });
        });
      });
    });

    describe('when bindings is not an object', function() {
      it('should error', function() {
        expect(function() {
          target.bindRequests(channel, 'replyFoo');
        }).to.throw('Bindings must be an object.');
      });
    });
  });

  describe('unbindRequests', function() {
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
            .and.calledWith({ 'bar': replyBar });
        });
      });

      describe('when handler is a string', function() {
        describe('when one handler is passed', function() {
          it('should unbind an request', function() {
            target.unbindRequests(channel, { 'foo': 'replyFoo' });
            expect(channel.stopReplying)
              .to.have.been.calledOnce
              .and.calledWith({ 'foo': target.replyFoo });
          });
        });
      });
    });

    describe('when bindings is not an object', function() {
      it('should error', function() {
        expect(function() {
          target.unbindRequests(channel, 'replyFoo');
        }).to.throw('Bindings must be an object.');
      });
    });
  });
});
