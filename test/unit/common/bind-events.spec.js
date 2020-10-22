import { bindEvents, unbindEvents } from '../../../src/common/bind-events';

describe('bind-events', function() {
  let entity;
  let target;

  beforeEach(function() {
    entity = this.sinon.stub();

    target = {
      handleFoo: this.sinon.stub(),
      listenTo: this.sinon.stub(),
      stopListening: this.sinon.stub(),
      bindEvents,
      unbindEvents
    };

    this.sinon.spy(target, 'bindEvents');
    this.sinon.spy(target, 'unbindEvents');
  });

  describe('bindEvents', function() {
    describe('when entity isnt passed', function() {
      beforeEach(function() {
        target.bindEvents(false, { 'foo': 'handleFoo' });
      });

      it('shouldnt bind any events', function() {
        expect(target.listenTo).not.to.have.been.called;
      });

      it('should return the target', function() {
        expect(target.bindEvents).to.have.returned(target);
      });
    });

    describe('when bindings isnt passed', function() {
      beforeEach(function() {
        target.bindEvents(entity, null);
      });

      it('shouldnt bind any events', function() {
        expect(target.listenTo).not.to.have.been.called;
      });

      it('should return the target', function() {
        expect(target.bindEvents).to.have.returned(target);
      });
    });

    describe('when bindings is an object with an event handler hash', function() {
      it('should return the target', function() {
        target.bindEvents(entity, { 'foo': 'handleFoo' });
        expect(target.bindEvents).to.have.returned(target);
      });

      describe('when handler is a function', function() {
        it('should bind an event to targets handler', function() {
          const handleBar = this.sinon.stub();
          target.bindEvents(entity, { 'bar': handleBar });
          expect(target.listenTo)
            .to.have.been.calledOnce
            .and.calledWith(entity, { 'bar': handleBar });
        });
      });

      describe('when handler is a string', function() {
        it('should bind an event to targets handler', function() {
          target.bindEvents(entity, { 'foo': 'handleFoo' });
          expect(target.listenTo)
            .to.have.been.calledOnce
            .and.calledWith(entity, { 'foo': target.handleFoo });
        });
      });
    });

    describe('when bindings is not an object', function() {
      it('should error', function() {
        expect(function() {
          target.bindEvents(entity, 'handleFoo');
        }).to.throw('Bindings must be an object.');
      });
    });
  });

  describe('unbindEvents', function() {
    describe('when entity isnt passed', function() {
      beforeEach(function() {
        target.unbindEvents(false, { 'foo': 'handleFoo' });
      });

      it('shouldnt unbind any events', function() {
        expect(target.stopListening).not.to.have.been.called;
      });

      it('should return the target', function() {
        expect(target.unbindEvents).to.have.returned(target);
      });
    });

    describe('when bindings isnt passed', function() {
      beforeEach(function() {
        target.unbindEvents(entity, null);
      });

      it('should unbind all events', function() {
        expect(target.stopListening)
          .to.have.been.calledOnce
          .and.calledWith(entity);
      });

      it('should return the target', function() {
        expect(target.unbindEvents).to.have.returned(target);
      });
    });

    describe('when bindings is an object with an event handler hash', function() {
      it('should return the target', function() {
        target.unbindEvents(entity, { 'foo': 'handleFoo' })
        expect(target.unbindEvents).to.have.returned(target);
      });

      describe('when handler is a function', function() {
        it('should unbind an event', function() {
          const handleBar = this.sinon.stub();
          target.unbindEvents(entity, { 'bar': handleBar });
          expect(target.stopListening)
            .to.have.been.calledOnce
            .and.calledWith(entity, { 'bar': handleBar });
        });
      });

      describe('when handler is a string', function() {
        describe('when one handler is passed', function() {
          it('should unbind an event', function() {
            target.unbindEvents(entity, { 'foo': 'handleFoo' });
            expect(target.stopListening)
              .to.have.been.calledOnce
              .and.calledWith(entity, { 'foo': target.handleFoo });
          });
        });
      });
    });

    describe('when bindings is not an object', function() {
      it('should error', function() {
        expect(function() {
          target.unbindEvents(entity, 'handleFoo');
        }).to.throw('Bindings must be an object.');
      });
    });
  });
});
