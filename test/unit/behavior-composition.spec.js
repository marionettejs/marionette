import Behavior from '../../src/modules/behavior';
import CommonMixin from '../../src/mixins/common';
import DelegateEntityEventsMixin from '../../src/mixins/delegate-entity-events';
import StateMixin from '../../src/mixins/state';
import UIMixin from '../../src/mixins/ui';
import ViewEventsMixin from '../../src/mixins/view-events';
import extend from '../../src/utils/extend';
import { setEventDelegator } from '../../src/runtime/event-delegator';

const mixins = [
  CommonMixin,
  DelegateEntityEventsMixin,
  StateMixin,
  UIMixin,
  ViewEventsMixin
];

function IsolatedBehavior(overrides = {}) {
  return Behavior.extend({
    _setOptions() {},
    _initViewEvents() {},
    _syncElement() { return this; },
    listenTo() { return this; },
    ...overrides
  });
}

function assignmentDescriptor(value) {
  return {
    configurable: true,
    enumerable: true,
    value,
    writable: true
  };
}

describe('Behavior composition', function() {
  describe('construction', function() {
    it('resolves UI in order on each receiver with zero arguments', function() {
      const calls = [];
      const behaviorUI = { first: '.first', shared: '.behavior' };
      const hostUI = { shared: '.host', last: '.last' };
      const host = {
        el: document.createElement('div'),
        ui() {
          calls.push(['hostUI', this, [...arguments]]);
          return hostUI;
        }
      };
      const TracedBehavior = Behavior.extend({
        _setOptions(...args) {
          calls.push(['setOptions', this, args]);
        },
        _initViewEvents(...args) {
          calls.push(['initViewEvents', this, args]);
        },
        _initStateEvents(...args) {
          calls.push(['initStateEvents', this, args]);
        },
        ui() {
          calls.push(['behaviorUI', this, [...arguments]]);
          return behaviorUI;
        },
        _syncElement(...args) {
          calls.push(['syncElement', this, args]);
          return this;
        },
        listenTo(...args) {
          calls.push(['listenTo', this, args]);
          return this;
        },
        initialize(...args) {
          calls.push(['initialize', this, args]);
        }
      });
      const options = { option: true };
      const behavior = new TracedBehavior(options, host, 'extra');

      expect(calls).to.deep.equal([
        ['setOptions', behavior, [options, [
          'collectionEvents',
          'events',
          'modelEvents',
          'stateEvents',
          'triggers',
          'ui'
        ]]],
        ['initViewEvents', behavior, []],
        ['behaviorUI', behavior, []],
        ['hostUI', host, []],
        ['listenTo', behavior, [host, 'all', behavior.triggerMethod]],
        ['initialize', behavior, [options, host, 'extra']],
        ['initStateEvents', behavior, []],
        ['syncElement', behavior, []]
      ]);
      expect(Object.keys(behavior.ui)).to.deep.equal(['first', 'shared', 'last']);
      expect(behavior.ui).to.deep.equal({ first: '.first', shared: '.host', last: '.last' });
      expect(behavior.ui).to.not.equal(behaviorUI);
      expect(behavior.ui).to.not.equal(hostUI);
      expect(behaviorUI).to.deep.equal({ first: '.first', shared: '.behavior' });
      expect(hostUI).to.deep.equal({ shared: '.host', last: '.last' });
    });

    it('reads each UI property once before calling the resolved functions', function() {
      const calls = [];
      const UIBehavior = IsolatedBehavior();
      Object.defineProperty(UIBehavior.prototype, 'ui', {
        configurable: true,
        get() {
          calls.push(['behaviorGet', this]);
          return function() {
            calls.push(['behaviorCall', this, [...arguments]]);
            return { behavior: true };
          };
        },
        set(value) {
          calls.push(['behaviorSet', this, value]);
          Object.defineProperty(this, 'ui', {
            configurable: true,
            enumerable: true,
            value,
            writable: true
          });
        }
      });
      const hostTarget = { el: document.createElement('div') };
      const host = new Proxy(hostTarget, {
        get(object, key, receiver) {
          if (key === 'ui') {
            calls.push(['hostGet', receiver]);
            return function() {
              calls.push(['hostCall', this, [...arguments]]);
              return { host: true };
            };
          }
          return Reflect.get(object, key, receiver);
        }
      });
      const behavior = new UIBehavior({}, host);

      expect(calls).to.deep.equal([
        ['behaviorGet', behavior],
        ['behaviorCall', behavior, []],
        ['hostGet', host],
        ['hostCall', host, []],
        ['behaviorSet', behavior, behavior.ui]
      ]);
      expect(behavior.ui).to.deep.equal({ behavior: true, host: true });
    });

    it('finishes both UI resolutions before reading either source map', function() {
      const calls = [];
      const behaviorUI = {};
      Object.defineProperty(behaviorUI, 'behavior', {
        enumerable: true,
        get() {
          calls.push('behaviorValue');
          return true;
        }
      });
      const UIBehavior = IsolatedBehavior({
        ui() {
          calls.push('behaviorUI');
          return behaviorUI;
        }
      });
      const host = { el: document.createElement('div') };
      Object.defineProperty(host, 'ui', {
        get() {
          calls.push('hostUI');
          throw new Error('host UI failed');
        }
      });

      expect(() => new UIBehavior({}, host)).to.throw('host UI failed');
      expect(calls).to.deep.equal(['behaviorUI', 'hostUI']);
    });

    it('merges only own UI keys and safely owns __proto__', function() {
      const behaviorProtoValue = { behavior: true };
      const hostProtoValue = { host: true };
      const behaviorUI = Object.assign(Object.create({ inheritedBehavior: '.ignored' }), {
        behavior: '.behavior',
        shared: '.behavior-shared'
      });
      const hostUI = Object.assign(Object.create({ inheritedHost: '.ignored' }), {
        shared: '.host-shared',
        host: '.host'
      });
      Object.defineProperty(behaviorUI, '__proto__', {
        enumerable: true,
        value: behaviorProtoValue
      });
      Object.defineProperty(hostUI, '__proto__', {
        enumerable: true,
        value: hostProtoValue
      });
      const UIBehavior = IsolatedBehavior({ ui: behaviorUI });
      const host = { el: document.createElement('div'), ui: hostUI };

      const behavior = new UIBehavior({}, host);

      expect(Object.keys(behavior.ui)).to.deep.equal(['behavior', 'shared', '__proto__', 'host']);
      expect(behavior.ui).to.include({
        behavior: '.behavior',
        shared: '.host-shared',
        host: '.host'
      });
      expect(behavior.ui).to.not.have.property('inheritedBehavior');
      expect(behavior.ui).to.not.have.property('inheritedHost');
      expect(Object.getPrototypeOf(behavior.ui)).to.equal(Object.prototype);
      expect(Object.getOwnPropertyDescriptor(behavior.ui, '__proto__'))
        .to.deep.equal(assignmentDescriptor(hostProtoValue));
      expect(Object.getPrototypeOf(behaviorUI)).to.not.equal(Object.prototype);
      expect(Object.getPrototypeOf(hostUI)).to.not.equal(Object.prototype);
      expect(Reflect.get(behaviorUI, '__proto__')).to.equal(behaviorProtoValue);
      expect(Reflect.get(hostUI, '__proto__')).to.equal(hostProtoValue);
    });
  });

  describe('fixed mixin composition', function() {
    it('preserves static and prototype identities, descriptors, and key order', function() {
      const finalKeys = [
        'cidPrefix',
        '$',
        'destroy',
        '_syncElement',
        'bindUIElements',
        'unbindUIElements',
        'getUI',
        'delegateEntityEvents',
        'undelegateEntityEvents'
      ];
      const expectedKeys = [];
      [...mixins, Object.fromEntries(finalKeys.map(key => [key, Behavior.prototype[key]]))]
        .forEach(source => {
          Object.keys(source).forEach(key => {
            if (!expectedKeys.includes(key)) { expectedKeys.push(key); }
          });
        });

      expect(Behavior.extend).to.equal(extend);
      expect(Behavior.setEventDelegator).to.equal(setEventDelegator);
      expect(Object.getOwnPropertyDescriptor(Behavior, 'extend'))
        .to.deep.equal(assignmentDescriptor(extend));
      expect(Object.getOwnPropertyDescriptor(Behavior, 'setEventDelegator'))
        .to.deep.equal(assignmentDescriptor(setEventDelegator));
      expect(Object.keys(Behavior.prototype)).to.deep.equal(expectedKeys);
      mixins.forEach(mixin => {
        Object.keys(mixin).forEach(key => {
          expect(Object.getOwnPropertyDescriptor(Behavior.prototype, key))
            .to.deep.equal(assignmentDescriptor(mixin[key]));
        });
      });
      expect(Object.getOwnPropertyDescriptor(Behavior.prototype, 'constructor')).to.deep.equal({
        configurable: true,
        enumerable: false,
        value: Behavior,
        writable: true
      });
    });

    it('excludes inherited pollution and safely owns a fixed-source __proto__', async function() {
      const prototypes = mixins.map(Object.getPrototypeOf);
      const commonProtoDescriptor = Object.getOwnPropertyDescriptor(CommonMixin, '__proto__');
      const protoValue = { safe: true };
      const mutatedMixins = [];
      let commonProtoMutated = false;
      let IsolatedBehaviorClass;
      let primaryFailed = false;
      let primaryError;

      try {
        mixins.forEach(mixin => {
          const pollutedPrototype = {};
          Object.defineProperty(pollutedPrototype, 'inheritedComposition', {
            enumerable: true,
            get() {
              throw new Error('inherited composition was read');
            }
          });
          Object.setPrototypeOf(mixin, pollutedPrototype);
          mutatedMixins.push(mixin);
        });
        Object.defineProperty(CommonMixin, '__proto__', {
          configurable: true,
          enumerable: true,
          value: protoValue,
          writable: true
        });
        commonProtoMutated = true;

        ({ default: IsolatedBehaviorClass } = await import('../../src/modules/behavior.ts?composition-test'));
      } catch (error) {
        primaryFailed = true;
        primaryError = error;
      }

      let cleanupFailed = false;
      let cleanupError;
      const restore = callback => {
        try {
          callback();
        } catch (error) {
          if (!cleanupFailed) {
            cleanupFailed = true;
            cleanupError = error;
          }
        }
      };

      if (commonProtoMutated) {
        restore(() => {
          if (commonProtoDescriptor) {
            Object.defineProperty(CommonMixin, '__proto__', commonProtoDescriptor);
          } else if (!Reflect.deleteProperty(CommonMixin, '__proto__')) {
            throw new Error('Unable to restore CommonMixin.__proto__');
          }
        });
      }
      for (let index = mutatedMixins.length - 1; index >= 0; index--) {
        restore(() => Object.setPrototypeOf(mutatedMixins[index], prototypes[index]));
      }

      if (primaryFailed) { throw primaryError; }
      if (cleanupFailed) { throw cleanupError; }

      expect(IsolatedBehaviorClass).to.not.equal(Behavior);
      expect(IsolatedBehaviorClass.prototype).to.not.have.own.property('inheritedComposition');
      expect(Object.getPrototypeOf(IsolatedBehaviorClass.prototype)).to.equal(Object.prototype);
      expect(Object.getOwnPropertyDescriptor(IsolatedBehaviorClass.prototype, '__proto__'))
        .to.deep.equal(assignmentDescriptor(protoValue));
    });
  });
});
