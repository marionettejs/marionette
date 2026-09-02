import vm from 'node:vm';

import BehaviorsMixin from '../../../mixins/behaviors';
import CommonMixin from '../../../mixins/common';
import DelegateEntityEventsMixin from '../../../mixins/delegate-entity-events';
import StateMixin from '../../../mixins/state';
import TemplateRenderMixin from '../../../mixins/template-render';
import UIMixin from '../../../mixins/ui';
import ViewMixin from '../../../mixins/view';
import ViewEventsMixin from '../../../mixins/view-events';
import MarionetteError from '../../../utils/error';

const mixins = [
  BehaviorsMixin,
  CommonMixin,
  DelegateEntityEventsMixin,
  StateMixin,
  TemplateRenderMixin,
  UIMixin,
  ViewEventsMixin
];

const directKeys = [
  'tagName',
  'preinitialize',
  'Dom',
  '_validateEl',
  '_getEl',
  '$',
  '_isElAttached',
  'supportsRenderLifecycle',
  'supportsDestroyLifecycle',
  '_isDestroyed',
  'isDestroyed',
  '_isRendered',
  'isRendered',
  '_isAttached',
  'isAttached',
  'delegateEvents',
  'undelegateEvents',
  'delegateEntityEvents',
  'undelegateEntityEvents',
  'destroy',
  'bindUIElements',
  'unbindUIElements',
  'getUI',
  '_buildEventProxies',
  '_getEventPrefix',
  '_proxyChildViewEvents',
  '_childViewEventHandler'
];

function assignmentDescriptor(value) {
  return {
    configurable: true,
    enumerable: true,
    value,
    writable: true
  };
}

describe('ViewMixin owned helpers', function() {
  describe('#_getEl', function() {
    it('resolves inherited options in order on the view with zero arguments', function() {
      const calls = [];
      const optionPrototype = Object.create(ViewMixin);
      const attributes = { shared: 'attributes', title: 'owned' };
      const element = {};
      const defineOption = (key, value) => {
        Object.defineProperty(optionPrototype, key, {
          configurable: true,
          get() {
            calls.push([`${key}:get`, this]);
            return function() {
              calls.push([`${key}:call`, this, [...arguments]]);
              return value;
            };
          }
        });
      };
      defineOption('el', undefined);
      defineOption('tagName', 'section');
      defineOption('attributes', attributes);
      defineOption('id', 'resolved-id');
      defineOption('className', 'resolved-class');
      const view = Object.create(optionPrototype);
      view.Dom = {
        createElement(tagName) {
          calls.push(['createElement', this, tagName]);
          return element;
        },
        setAttributes(el, attrs) {
          calls.push(['setAttributes', this, el, attrs]);
        }
      };

      expect(view._getEl()).to.equal(element);
      expect(calls).to.deep.equal([
        ['el:get', view],
        ['el:call', view, []],
        ['tagName:get', view],
        ['tagName:call', view, []],
        ['createElement', view.Dom, 'section'],
        ['attributes:get', view],
        ['attributes:call', view, []],
        ['id:get', view],
        ['id:get', view],
        ['id:call', view, []],
        ['className:get', view],
        ['className:get', view],
        ['className:call', view, []],
        ['setAttributes', view.Dom, element, {
          shared: 'attributes',
          title: 'owned',
          id: 'resolved-id',
          class: 'resolved-class'
        }]
      ]);
      expect(attributes).to.deep.equal({ shared: 'attributes', title: 'owned' });
    });

    it('stops after a failing second id resolution read', function() {
      const calls = [];
      let idReads = 0;
      const view = Object.create(ViewMixin);
      view.el = null;
      view.tagName = 'div';
      view.attributes = {};
      view.Dom = {
        createElement() { return {}; },
        setAttributes() { calls.push('setAttributes'); }
      };
      Object.defineProperty(view, 'id', {
        get() {
          calls.push('id');
          if (++idReads === 2) { throw new Error('id failed'); }
          return () => 'id';
        }
      });
      Object.defineProperty(view, 'className', {
        get() {
          calls.push('className');
          return 'class';
        }
      });

      expect(() => view._getEl()).to.throw('id failed');
      expect(calls).to.deep.equal(['id', 'id']);
    });

    it('reads falsy id and className guards only once', function() {
      const calls = [];
      const view = Object.create(ViewMixin);
      view.el = null;
      view.tagName = 'div';
      view.attributes = {};
      view.Dom = {
        createElement() { return {}; },
        setAttributes(element, attrs) { calls.push(['attrs', attrs]); }
      };
      Object.defineProperty(view, 'id', {
        get() { calls.push('id'); return 0; }
      });
      Object.defineProperty(view, 'className', {
        get() { calls.push('className'); return ''; }
      });

      view._getEl();

      expect(calls).to.deep.equal(['id', 'className', ['attrs', {}]]);
    });
  });

  describe('#_buildEventProxies', function() {
    it('resolves each map in order on the view with zero arguments', function() {
      const calls = [];
      const events = { event: 'handler' };
      const triggers = { event: 'trigger' };
      const view = Object.create(ViewMixin);
      view.childViewEvents = function() {
        calls.push(['events', this, [...arguments]]);
        return events;
      };
      view.normalizeMethods = function(value) {
        calls.push(['normalize', this, value]);
        return { normalized: true };
      };
      view.childViewTriggers = function() {
        calls.push(['triggers', this, [...arguments]]);
        return triggers;
      };
      view._getEventPrefix = function() {
        calls.push(['prefix', this, [...arguments]]);
        return 'prefix:';
      };

      view._buildEventProxies();

      expect(calls).to.deep.equal([
        ['events', view, []],
        ['normalize', view, events],
        ['triggers', view, []],
        ['prefix', view, []]
      ]);
      expect(view._childViewEvents).to.deep.equal({ normalized: true });
      expect(view._childViewTriggers).to.equal(triggers);
      expect(view._eventPrefix).to.equal('prefix:');
    });

    it('does not resolve later options when normalization throws', function() {
      const calls = [];
      const view = Object.create(ViewMixin);
      view.childViewEvents = function() { calls.push('events'); return {}; };
      view.normalizeMethods = function() { calls.push('normalize'); throw new Error('invalid events'); };
      Object.defineProperty(view, 'childViewTriggers', {
        get() { calls.push('triggers'); return {}; }
      });
      view._getEventPrefix = function() { calls.push('prefix'); };

      expect(() => view._buildEventProxies()).to.throw('invalid events');
      expect(calls).to.deep.equal(['events', 'normalize']);
    });
  });

  describe('#_getEventPrefix', function() {
    it('uses the disabled default only when the property is undefined', function() {
      const missing = Object.create(ViewMixin);
      const resolvedUndefined = Object.create(ViewMixin);
      resolvedUndefined.childViewEventPrefix = () => undefined;

      expect(missing._getEventPrefix()).to.be.false;
      expect(resolvedUndefined._getEventPrefix()).to.equal('undefined:');
      for (const [value, expected] of [[false, false], [null, 'null:'], [0, '0:'], ['', ':']]) {
        const view = Object.create(ViewMixin);
        view.childViewEventPrefix = value;
        expect(view._getEventPrefix()).to.equal(expected);
      }
    });

    it('calls and coerces an inherited prefix on the view in order', function() {
      const calls = [];
      const optionPrototype = Object.create(ViewMixin);
      optionPrototype.childViewEventPrefix = function() {
        calls.push(['call', this, [...arguments]]);
        return {
          [Symbol.toPrimitive](hint) {
            calls.push(['coerce', hint]);
            return 'custom';
          }
        };
      };
      const view = Object.create(optionPrototype);

      expect(view._getEventPrefix()).to.equal('custom:');
      expect(calls).to.deep.equal([
        ['call', view, []],
        ['coerce', 'default']]
      );
    });

    it('propagates prefix coercion errors', function() {
      const view = Object.create(ViewMixin);
      view.childViewEventPrefix = Symbol('prefix');

      expect(() => view._getEventPrefix()).to.throw(TypeError);
    });
  });

  describe('#_validateEl', function() {
    it('uses the shared String-tag classification', function() {
      const tagged = { [Symbol.toStringTag]: 'String', toString: () => '#tagged' };
      const values = [
        new String('#boxed'),
        vm.runInNewContext('new String("#cross-realm")'),
        tagged
      ];

      values.forEach(value => {
        expect(() => ViewMixin._validateEl(value))
          .to.throw(MarionetteError)
          .with.property('code', 'MN0001');
      });
      const proxiedBoxed = new Proxy(new String('#proxy'), {});
      expect(ViewMixin._validateEl(proxiedBoxed)).to.equal(proxiedBoxed);
    });
  });

  describe('fixed composition', function() {
    it('preserves own method order, identities, and assignment descriptors', function() {
      const expectedKeys = [...directKeys];
      const expectedValues = new Map(directKeys.map(key => [key, ViewMixin[key]]));
      mixins.forEach(mixin => {
        Object.keys(mixin).forEach(key => {
          if (!expectedKeys.includes(key)) { expectedKeys.push(key); }
          expectedValues.set(key, mixin[key]);
        });
      });

      expect(Object.keys(ViewMixin)).to.deep.equal(expectedKeys);
      expectedValues.forEach((value, key) => {
        expect(Object.getOwnPropertyDescriptor(ViewMixin, key))
          .to.deep.equal(assignmentDescriptor(value));
      });
      expect(Object.getPrototypeOf(ViewMixin)).to.equal(Object.prototype);
    });

    it('excludes inherited pollution and safely owns fixed-source built-in keys', async function() {
      const source = CommonMixin;
      const sourcePrototype = Object.getPrototypeOf(source);
      const keys = ['constructor', 'toString', '__proto__'];
      const descriptors = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(source, key)]));
      const values = {
        constructor() {},
        toString() {},
        __proto__() {}
      };
      const cleanup = [];
      let IsolatedViewMixin;
      let primaryError;

      try {
        const pollutedPrototype = {};
        Object.defineProperty(pollutedPrototype, 'inheritedComposition', {
          enumerable: true,
          get() { throw new Error('inherited composition was read'); }
        });
        Object.setPrototypeOf(source, pollutedPrototype);
        cleanup.push(() => Object.setPrototypeOf(source, sourcePrototype));
        keys.forEach(key => {
          Object.defineProperty(source, key, assignmentDescriptor(values[key]));
          cleanup.push(() => {
            const descriptor = descriptors.get(key);
            if (descriptor) {
              Object.defineProperty(source, key, descriptor);
            } else if (!Reflect.deleteProperty(source, key)) {
              throw new Error(`Unable to restore CommonMixin.${key}`);
            }
          });
        });

        ({ default: IsolatedViewMixin } = await import('../../../mixins/view.js?composition-test'));
      } catch (error) {
        primaryError = error;
      }

      let cleanupError;
      for (let index = cleanup.length - 1; index >= 0; index--) {
        try {
          cleanup[index]();
        } catch (error) {
          cleanupError = cleanupError || error;
        }
      }

      if (primaryError) { throw primaryError; }
      if (cleanupError) { throw cleanupError; }

      expect(IsolatedViewMixin).to.not.equal(ViewMixin);
      expect(IsolatedViewMixin).to.not.have.own.property('inheritedComposition');
      expect(Object.getPrototypeOf(IsolatedViewMixin)).to.equal(Object.prototype);
      keys.forEach(key => {
        expect(Object.getOwnPropertyDescriptor(IsolatedViewMixin, key))
          .to.deep.equal(assignmentDescriptor(values[key]));
      });
    });
  });
});
