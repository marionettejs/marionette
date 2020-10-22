import { VERSION } from '../../../src/backbone.marionette';
import MarionetteError from '../../../src/utils/error';

describe('MarionetteError', function() {
  it('should be subclass of native Error', function() {
    expect(new MarionetteError({ message: 'foo' })).to.be.instanceOf(Error);
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
  });

  describe('when Error.captureStackTrace is unavailable', function() {
    let captureStackTrace = Error.captureStackTrace;

    beforeEach(function() {
      this.sinon.spy(MarionetteError.prototype, 'captureStackTrace');
      Error.captureStackTrace = undefined;
    });

    afterEach(function() {
      Error.captureStackTrace = captureStackTrace;
    });

    it('should not captureStackTrace', function() {
      new MarionetteError({ message: 'foo' });
      expect(MarionetteError.prototype.captureStackTrace).to.not.be.called;
    });
  })
});
