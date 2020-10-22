import deprecate from '../../../src/utils/deprecate';

import {setEnabled} from '../../../src/config/features';

describe('deprecate', function() {
  beforeEach(function() {
    setEnabled('DEV_MODE', true);
    this.sinon.spy(deprecate, '_warn');
    this.sinon.stub(deprecate._console, 'warn');
    this.sinon.stub(deprecate._console, 'log');

    deprecate._cache = {};
  });

  afterEach(function() {
    setEnabled('DEV_MODE', false);
  });

  describe('#_warn', function() {
    it('should `console.warn` the message', function() {
      deprecate._warn('foo');
      expect(deprecate._console.warn)
        .to.have.been.calledOnce
        .and.calledOn(deprecate._console)
        .and.calledWith('foo');
    });

    describe('when `console.warn` does not exist', function() {
      beforeEach(function() {
        deprecate._console.warn = null;
      });

      it('should `console.log` the message', function() {
        deprecate._warn('foo');
        expect(deprecate._console.log)
          .to.have.been.calledOnce
          .and.calledOn(deprecate._console)
          .and.calledWith('foo');
      });

      describe('when `console.log` does not exist', function() {
        it('should call `_.noop`', function() {
          deprecate._console.log = null;
          this.sinon.spy(_, 'noop');
          deprecate._warn('foo');

          expect(_.noop).to.have.been.calledOnce;
        });
      });
    });
  });

  describe('when calling with a message', function() {
    beforeEach(function() {
      deprecate('foo');
    });

    it('should `console.warn` the message', function() {
      expect(deprecate._warn)
        .to.have.been.calledOnce
        .and.calledWith('Deprecation warning: foo');
    });
  });

  describe('when calling with an object', function() {
    beforeEach(function() {
      deprecate({
        prev: 'foo',
        next: 'bar'
      });
    });

    it('should `console.warn` the message', function() {
      expect(deprecate._warn)
        .to.have.been.calledOnce
        .and.calledWith('Deprecation warning: foo is going to be removed in the future. Please use bar instead.');
    });
  });

  describe('when calling with an object with a url', function() {
    beforeEach(function() {
      deprecate({
        prev: 'foo',
        next: 'bar',
        url: 'baz'
      });
    });

    it('should `console.warn` the message', function() {
      expect(deprecate._warn)
        .to.have.been.calledOnce
        .and.calledWith('Deprecation warning: foo is going to be removed in the future. Please use bar instead. See: baz');
    });
  });

  describe('when calling with a message and a falsy test', function() {
    beforeEach(function() {
      deprecate('bar', false);
    });

    it('should `console.warn` the message', function() {
      expect(deprecate._warn)
        .to.have.been.calledOnce
        .and.calledWith('Deprecation warning: bar');
    });
  });

  describe('when calling with a message and a truthy test', function() {
    beforeEach(function() {
      deprecate('Foo', true);
    });

    it('should not `console.warn` the message', function() {
      expect(deprecate._warn).not.to.have.been.called;
    });
  });

  describe('when calling with the same message twice', function() {
    beforeEach(function() {
      deprecate('baz');
      deprecate('baz');
    });

    it('should `console.warn` the message', function() {
      expect(deprecate._warn)
        .to.have.been.calledOnce
        .and.calledWith('Deprecation warning: baz');
    });
  });

  describe('when calling in production mode', function() {
    beforeEach(function() {
      setEnabled('DEV_MODE', false);
      deprecate('baz');
    });

    it('should `console.warn` the message', function() {
      expect(deprecate._warn).to.not.have.been.called;
    });
  });
});
