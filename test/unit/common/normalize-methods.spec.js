import View from '../../../src/view';

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
        'foo': 'foo',
        'bar': 'bar'
      };
      normalizedHash = view.normalizeMethods(hash);
    });

    it('should convert the strings that exist as functions to functions', function() {
      expect(normalizedHash).to.have.property('foo');
    });

    it('should ignore strings that dont exist as functions on the context', function() {
      expect(normalizedHash).not.to.have.property('bar');
    });
  });
});
