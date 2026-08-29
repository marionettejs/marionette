import _ from 'underscore';
import CommonMixin from '../../../mixins/common';

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

    it('merges only own options and safely owns __proto__', function() {
      const protoValue = { polluted: true };
      const defaults = Object.assign(
        Object.create({ inheritedDefault: true }),
        { ownDefault: true }
      );
      const passed = Object.assign(
        Object.create({ inheritedPassed: true }),
        { ownPassed: true }
      );
      Object.defineProperty(passed, '__proto__', { enumerable: true, value: protoValue });
      const target = _.extend({
        options() {
          return defaults;
        }
      }, CommonMixin);

      target._setOptions(passed, []);

      expect(target.options).to.include({ ownDefault: true, ownPassed: true });
      expect(target.options).to.not.have.property('inheritedDefault');
      expect(target.options).to.not.have.property('inheritedPassed');
      expect(Object.getPrototypeOf(target.options)).to.equal(Object.prototype);
      expect(Object.hasOwn(target.options, '__proto__')).to.be.true;
      expect(Object.getOwnPropertyDescriptor(target.options, '__proto__').value)
        .to.equal(protoValue);
    });
  });
});
