import { bindEvents, unbindEvents } from '../../../modules/common/bind-events';

function createProtoBindings(descriptor) {
  const bindings = {};
  Object.defineProperty(bindings, '__proto__', {
    enumerable: true,
    ...descriptor
  });
  return bindings;
}

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

const rejectedBindingMaps = [true, 1, 1n, 'handleFoo', Symbol('bindings')];

const falsyBindingMaps = [undefined, null, false, 0, 0n, '', NaN];

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

    it('preserves accepted object and function binding maps', function() {
      for (const bindings of acceptedBindingMaps) {
        expect(target.bindEvents(entity, bindings)).to.equal(target);
        expect(target.listenTo).to.have.been.calledOnce;
        target.listenTo.resetHistory();
      }
    });

    it('preserves the falsy binding-map early return', function() {
      for (const bindings of falsyBindingMaps) {
        expect(target.bindEvents(entity, bindings)).to.equal(target);
      }

      expect(target.listenTo).to.not.have.been.called;
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

      it('accepts other Object prototype collision names', function() {
        const constructorHandler = this.sinon.stub();
        const toStringHandler = this.sinon.stub();

        target.bindEvents(entity, {
          constructor: constructorHandler,
          toString: toStringHandler
        });

        expect(target.listenTo).to.have.been.calledOnce.and.calledWith(entity, {
          constructor: constructorHandler,
          toString: toStringHandler
        });
      });

      it('rejects an own enumerable __proto__ event before binding', function() {
        const getter = this.sinon.stub().throws(new Error('must not run'));
        const bindings = createProtoBindings({ get: getter });

        expect(() => target.bindEvents(entity, bindings))
          .to.throw('Entity event maps cannot include an own "__proto__" event name.')
          .with.property('code', 'MN0026');
        expect(getter).to.not.have.been.called;
        expect(target.listenTo).to.not.have.been.called;
      });
    });

    describe('when bindings is not an object', function() {
      it('rejects truthy primitives before binding', function() {
        for (const bindings of rejectedBindingMaps) {
          const bind = target.bindEvents.bind(target, entity, bindings);
          expect(bind)
            .to.throw('Bindings must be an object.')
            .with.property('code', 'MN0009');
        }

        expect(target.listenTo).to.not.have.been.called;
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

    it('preserves accepted object and function binding maps', function() {
      for (const bindings of acceptedBindingMaps) {
        expect(target.unbindEvents(entity, bindings)).to.equal(target);
        expect(target.stopListening).to.have.been.calledOnce;
        target.stopListening.resetHistory();
      }
    });

    it('preserves the falsy binding-map unbind-all path', function() {
      for (const bindings of falsyBindingMaps) {
        expect(target.unbindEvents(entity, bindings)).to.equal(target);
        expect(target.stopListening).to.have.been.calledOnce.and.calledWith(entity);
        target.stopListening.resetHistory();
      }
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

      it('rejects an own enumerable __proto__ event before selective unbinding', function() {
        const bindings = createProtoBindings({ value: this.sinon.stub() });

        expect(() => target.unbindEvents(entity, bindings))
          .to.throw('Entity event maps cannot include an own "__proto__" event name.')
          .with.property('code', 'MN0026');
        expect(target.stopListening).to.not.have.been.called;
      });
    });

    describe('when bindings is not an object', function() {
      it('rejects truthy primitives before selective unbinding', function() {
        for (const bindings of rejectedBindingMaps) {
          const unbind = target.unbindEvents.bind(target, entity, bindings);
          expect(unbind)
            .to.throw('Bindings must be an object.')
            .with.property('code', 'MN0009');
        }

        expect(target.stopListening).to.not.have.been.called;
      });
    });
  });
});
