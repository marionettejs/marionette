import _ from 'underscore';
import CommonMixin from '../../../src/mixins/common';

describe('Common Mixin', function() {
  describe('#setOptions', function() {
    let object;
    const classOptions = [];
    const options = {
      foo: 'baz',
      baz: 'baz'
    };

    beforeEach(function() {
      object = _.extend({
        options() {
          return {
            foo: 'bar',
            bar: 'baz'
          };
        }
      }, CommonMixin);

      this.sinon.spy(object, 'mergeOptions');

      object._setOptions(options, classOptions);
    });

    it('should not mutate the options argument', function() {
      expect(options).to.eql({
        foo: 'baz',
        baz: 'baz'
      })
    });

    // This test covers merge order and options as a function
    it('should set options on the context', function() {
      expect(object.options).to.eql({
        foo: 'baz',
        bar: 'baz',
        baz: 'baz'
      });
    });

    it('should call mergeOptions', function() {
      expect(object.mergeOptions)
        .to.have.been.calledOnce
        .and.calledWith(options, classOptions);
    });
  });
});
