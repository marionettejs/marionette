import { MarionetteError as PublicMarionetteError, VERSION } from '../../src/index.ts';
import MarionetteError from '../../src/modules/error';

describe('MarionetteError', function() {
  it('should be subclass of native Error', function() {
    expect(new MarionetteError({ message: 'foo' })).to.be.instanceOf(Error);
  });

  it('is exposed through the public package entrypoint', function() {
    expect(PublicMarionetteError).to.equal(MarionetteError);
    expect(MarionetteError.prototype.constructor).to.equal(MarionetteError);
    expect(Object.getPrototypeOf(MarionetteError.prototype)).to.equal(Error.prototype);
  });

  it('requires construction with new', function() {
    expect(() => MarionetteError({ message: 'foo' })).to.throw(TypeError);
  });

  describe('when passed options', function() {
    let error;

    beforeEach(function() {
      error = new MarionetteError({
        name: 'Foo',
        message: 'Bar'
      });
    });

    it('should contain the correct properties', function() {
      expect(error).to.contain({
        name: 'Foo',
        message: 'Bar'
      });
    });

    it('should output the correct string', function() {
      expect(error.toString()).to.equal('Foo: Bar See: http://marionettejs.com/docs/v' + VERSION + '/');
    });
  });

  describe('when passed options with a url', function() {
    let error;

    beforeEach(function() {
      error = new MarionetteError({
        name: 'Foo',
        message: 'Bar',
        url: 'Baz'
      });
    });

    it('should contain the correct properties', function() {
      expect(error).to.contain({
        name: 'Foo',
        message: 'Bar',
        url: 'http://marionettejs.com/docs/v' + VERSION + '/Baz'
      });
    });

    it('should output the correct string', function() {
      expect(error.toString()).to.equal('Foo: Bar See: http://marionettejs.com/docs/v' + VERSION + '/Baz');
    });
  });

  describe('when passed valid error properties', function() {
    let props;
    let error;

    beforeEach(function() {
      props = {
        code: 'MN0001',
        description: 'myDescription',
        fileName: 'myFileName',
        lineNumber: 'myLineNumber',
        name: 'myName',
        message: 'myMessage',
        number: 'myNumber'
      };
      error = new MarionetteError(props);
    });

    it('should contain all the valid error properties', function() {
      expect(error).to.contain(props);
    });

    it('materializes allowed properties as ordinary own fields', function() {
      expect(Object.getOwnPropertyDescriptor(error, 'description')).to.deep.equal({
        value: 'myDescription',
        writable: true,
        enumerable: true,
        configurable: true
      });
    });
  });

  describe('when passed inherited or non-enumerable properties', function() {
    it('copies allowed properties regardless of ownership or enumerability', function() {
      const inherited = Object.create({ code: 'MN0001' });
      Object.defineProperty(inherited, 'description', {
        value: 'hidden',
        enumerable: false
      });

      const error = new MarionetteError(inherited);

      expect(error).to.contain({
        code: 'MN0001',
        description: 'hidden'
      });
      expect(error).to.have.ownProperty('code');
      expect(error).to.have.ownProperty('description');
    });

    it('lets present option values override native values, including undefined', function() {
      const options = Object.create({ name: 'InheritedName' });
      Object.defineProperty(options, 'message', {
        value: undefined,
        enumerable: false
      });

      const error = new MarionetteError(options);

      expect(error.name).to.equal('InheritedName');
      expect(error).to.have.ownProperty('message');
      expect(error.message).to.equal(undefined);
    });

    it('applies option properties after collecting native properties', function() {
      let reads = 0;
      const options = {
        get message() {
          reads += 1;
          return reads === 1 ? 'native message' : 'option message';
        }
      };

      const error = new MarionetteError(options);

      expect(error.message).to.equal('option message');
      expect(reads).to.equal(2);
    });
  });

  describe('when passed a proxy', function() {
    it('preserves allowed-property access order', function() {
      const accesses = [];
      const options = new Proxy({ message: 'foo', code: 'MN0001' }, {
        get(target, property, receiver) {
          accesses.push(`get:${String(property)}`);
          return Reflect.get(target, property, receiver);
        },
        has(target, property) {
          accesses.push(`has:${String(property)}`);
          return Reflect.has(target, property);
        }
      });

      new MarionetteError(options);

      expect(accesses).to.deep.equal([
        'get:message',
        'get:code', 'has:code',
        'get:description', 'has:description',
        'get:fileName', 'has:fileName',
        'get:lineNumber', 'has:lineNumber',
        'get:name', 'has:name',
        'get:message', 'has:message',
        'get:number', 'has:number',
        'get:url', 'has:url'
      ]);
    });

    it('propagates property access errors before checking presence', function() {
      const expectedError = new Error('description access failed');
      const options = new Proxy({ message: 'foo' }, {
        get(target, property, receiver) {
          if (property === 'description') {
            throw expectedError;
          }
          return Reflect.get(target, property, receiver);
        }
      });

      expect(() => new MarionetteError(options)).to.throw(expectedError);
    });
  });

  describe('when passed invalid error properties', function() {
    let props;
    let error;

    beforeEach(function() {
      props = {
        foo: 'myFoo',
        bar: 'myBar',
        baz: 'myBaz'
      };
      error = new MarionetteError(props);
    });

    it('should not contain invalid properties', function() {
      expect(error).not.to.contain(props);
    });

    it('does not copy unrelated enumerable Object.prototype properties', function() {
      // eslint-disable-next-line no-extend-native
      Object.defineProperty(Object.prototype, 'marionettePolluted', {
        value: 'polluted',
        writable: true,
        enumerable: true,
        configurable: true
      });

      try {
        const pollutedError = new MarionetteError({ message: 'foo' });

        expect(Object.hasOwn(pollutedError, 'marionettePolluted')).to.equal(false);
      } finally {
        Reflect.deleteProperty(Object.prototype, 'marionettePolluted');
      }
    });
  });

  describe('when Error.captureStackTrace is available', function() {
    beforeEach(function() {
      this.sinon.stub(Error, 'captureStackTrace').callsFake(error => {
        Object.defineProperty(error, 'stack', {
          value: 'captured stack',
          writable: true,
          configurable: true
        });
      });
    });

    it('captures and retains the framework error stack', function() {
      const error = new MarionetteError({ message: 'foo' });

      expect(Error.captureStackTrace).to.have.been.calledOnceWith(error, MarionetteError);
      expect(error.stack).to.equal('captured stack');
      expect(Object.getOwnPropertyDescriptor(error, 'stack')).to.deep.equal({
        value: 'captured stack',
        writable: true,
        enumerable: false,
        configurable: true
      });
    });
  });

  describe('when Error.captureStackTrace is not callable', function() {
    let captureStackTrace = Error.captureStackTrace;

    beforeEach(function() {
      this.sinon.spy(MarionetteError.prototype, 'captureStackTrace');
    });

    afterEach(function() {
      Error.captureStackTrace = captureStackTrace;
    });

    for (const [description, value] of [
      ['missing', undefined],
      ['truthy but non-function', {}]
    ]) {
      it(`retains the fallback stack when ${description}`, function() {
        Error.captureStackTrace = value;
        const error = new MarionetteError({ message: 'foo' });
        const fallbackError = MarionetteError.prototype.captureStackTrace.firstCall.firstArg;

        expect(MarionetteError.prototype.captureStackTrace).to.have.been.calledOnce;
        expect(fallbackError).to.be.instanceOf(Error);
        expect(error.stack).to.equal(fallbackError.stack).and.to.contain('Error: foo');
        expect(Object.getOwnPropertyDescriptor(error, 'stack')).to.include({
          writable: true,
          enumerable: true,
          configurable: true
        });
      });
    }
  })
});
