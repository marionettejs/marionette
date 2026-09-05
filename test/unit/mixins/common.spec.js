import _ from 'underscore';
import CommonMixin from '../../../src/mixins/common';
import EventsMixin from '../../../src/mixins/events';

describe('Common Mixin', function() {
  describe('#setOptions', function() {
    let object;
    let optionsMethod;
    const classOptions = [];
    const options = {
      foo: 'baz',
      baz: 'baz'
    };

    beforeEach(function() {
      optionsMethod = this.sinon.stub().returns({
        foo: 'bar',
        bar: 'baz'
      });
      object = _.extend({
        options: optionsMethod
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
      expect(optionsMethod)
        .to.have.been.calledOnce
        .and.calledOn(object)
        .and.calledWithExactly();
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

  describe('composition', function() {
    it('keeps the intended own method order and a clean object prototype', function() {
      const baseKeys = [
        'initialize',
        'normalizeMethods',
        '_setOptions',
        'mergeOptions',
        'getOption',
        'bindEvents',
        'unbindEvents',
        'bindRequests',
        'unbindRequests'
      ];
      const composedKeys = Object.keys(EventsMixin)
        .filter(methodName => !baseKeys.includes(methodName));

      expect(Object.keys(CommonMixin)).to.deep.equal([...baseKeys, ...composedKeys]);
      expect(Object.getPrototypeOf(CommonMixin)).to.equal(Object.prototype);
      expect(CommonMixin).to.not.have.own.property('constructor');
      expect(CommonMixin).to.not.have.own.property('toString');
      expect(CommonMixin).to.not.have.own.property('__proto__');
    });

    it('keeps each event method identity with assignment descriptors', function() {
      Object.keys(EventsMixin).forEach(methodName => {
        expect(Object.getOwnPropertyDescriptor(CommonMixin, methodName)).to.deep.equal({
          configurable: true,
          enumerable: true,
          value: EventsMixin[methodName],
          writable: true
        });
      });
    });

    it('does not compose the Radio channel request API', function() {
      ['reply', 'replyOnce', 'stopReplying', 'request'].forEach(methodName => {
        expect(CommonMixin).to.not.have.property(methodName);
      });
    });

    it('applies defaults before passed options and merges class options afterward', function() {
      const calls = [];
      const options = { shared: 'passed', passed: true };
      const object = Object.assign({}, CommonMixin, {
        mergeOptions(receivedOptions, classOptions) {
          calls.push(['mergeOptions', this.options, receivedOptions, classOptions]);
        },
        options() {
          calls.push(['options', this]);
          return { default: true, shared: 'default' };
        }
      });
      const classOptions = ['passed'];

      object._setOptions(options, classOptions);

      expect(object.options).to.deep.equal({ default: true, shared: 'passed', passed: true });
      expect(calls).to.deep.equal([
        ['options', object],
        ['mergeOptions', object.options, options, classOptions]
      ]);
    });

    it('does not compose inherited enumerable source pollution', async function() {
      const eventsPrototype = Object.getPrototypeOf(EventsMixin);
      Object.setPrototypeOf(EventsMixin, { inheritedEventPollution() {} });

      let IsolatedCommonMixin;
      try {
        expect(Object.hasOwn(EventsMixin, 'inheritedEventPollution')).to.equal(false);
        expect(EventsMixin.inheritedEventPollution).to.be.a('function');
        ({ default: IsolatedCommonMixin } = await import('../../../src/mixins/common.ts?composition-test'));
      } finally {
        Object.setPrototypeOf(EventsMixin, eventsPrototype);
      }

      expect(IsolatedCommonMixin).to.not.equal(CommonMixin);
      expect(IsolatedCommonMixin).to.not.have.own.property('inheritedEventPollution');
    });
  });
});
