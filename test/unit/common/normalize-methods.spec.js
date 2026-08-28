import View from '../../../modules/view';

describe('normalizeMethods', function() {
  'use strict';

  let view;

  beforeEach(function() {
    const MyView = View.extend({
      foo: this.sinon.stub()
    });
    view = new MyView();
  });

  describe('when called with no value', function() {
    it('should return nothing', function() {
      expect(view.normalizeMethods()).to.be.undefined;
    });
  });

  describe('when called with a hash of functions and strings', function() {
    let normalizedHash;
    let hash;

    beforeEach(function() {
      hash = {
        'foo': 'foo'
      };
      normalizedHash = view.normalizeMethods(hash);
    });

    it('should convert the strings that exist as functions to functions', function() {
      expect(normalizedHash).to.have.property('foo');
    });

    it('throws a stable diagnostic when a named handler does not exist', function() {
      expect(() => view.normalizeMethods({bar: 'bar'}))
        .to.throw('The handler "bar" for "bar" must resolve to a function.')
        .with.property('code', 'MN0019');
    });

    it('throws the same diagnostic when a named handler is not callable', function() {
      view.bar = true;

      expect(() => view.normalizeMethods({bar: 'bar'}))
        .to.throw('The handler "bar" for "bar" must resolve to a function.')
        .with.property('code', 'MN0019');
    });

    it('preserves non-string handler lookup behavior', function() {
      view[1] = view.foo;

      expect(view.normalizeMethods({found: 1, missing: 2})).to.eql({
        found: view.foo
      });
    });
  });
});
