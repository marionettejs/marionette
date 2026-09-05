import BehaviorsMixin from '../../../src/mixins/behaviors';

function assignmentDescriptor(value) {
  return {
    configurable: true,
    enumerable: true,
    value,
    writable: true
  };
}

describe('Behaviors Mixin owned iteration', function() {
  describe('#_initBehaviors', function() {
    it('resolves host and nested declarations on their owners in depth-first order', function() {
      const calls = [];

      function NestedBehavior(options, view) {
        calls.push(['nested:construct', this, options, view]);
      }

      const nestedDefinition = { behaviorClass: NestedBehavior, nested: true };

      function ParentBehavior(options, view) {
        calls.push(['parent:construct', this, options, view]);
        this.behaviors = function(...args) {
          calls.push(['nested:resolve', this, args]);
          return { nested: nestedDefinition };
        };
      }

      const parentDefinition = { behaviorClass: ParentBehavior, parent: true };

      function SiblingBehavior(options, view) {
        calls.push(['sibling:construct', this, options, view]);
      }

      const host = { ...BehaviorsMixin };
      Object.defineProperty(host, 'behaviors', {
        get() {
          calls.push(['host:get', this]);
          return function(...args) {
            calls.push(['host:resolve', this, args]);
            return [parentDefinition, SiblingBehavior];
          };
        }
      });

      host._initBehaviors();

      const [parent, nested, sibling] = host._behaviors;
      expect(calls).to.deep.equal([
        ['host:get', host],
        ['host:resolve', host, []],
        ['parent:construct', parent, parentDefinition, host],
        ['nested:resolve', parent, []],
        ['nested:construct', nested, nestedDefinition, host],
        ['sibling:construct', sibling, {}, host]
      ]);
      expect(host._behaviors).to.deep.equal([parent, nested, sibling]);
    });

    it('snapshots own object keys and reads each definition lazily', function() {
      const calls = [];
      const inheritedDefinitions = {};
      Object.defineProperty(inheritedDefinitions, 'inherited', {
        enumerable: true,
        get() {
          throw new Error('inherited definition was read');
        }
      });
      const definitions = Object.create(inheritedDefinitions);

      function FirstBehavior() {
        calls.push('construct:first');
      }
      function SecondBehavior() {
        calls.push('construct:second');
      }
      function LateBehavior() {
        calls.push('construct:late');
      }

      Object.defineProperties(definitions, {
        first: {
          enumerable: true,
          get() {
            calls.push('read:first');
            definitions.late = LateBehavior;
            return FirstBehavior;
          }
        },
        second: {
          enumerable: true,
          get() {
            calls.push('read:second');
            return SecondBehavior;
          }
        },
        hidden: {
          get() {
            throw new Error('hidden definition was read');
          }
        }
      });
      Object.defineProperty(definitions, Symbol('ignored'), {
        enumerable: true,
        get() {
          throw new Error('symbol definition was read');
        }
      });
      const host = { ...BehaviorsMixin, behaviors: definitions };

      host._initBehaviors();

      expect(calls).to.deep.equal([
        'read:first',
        'construct:first',
        'read:second',
        'construct:second'
      ]);
      expect(host._behaviors).to.have.lengthOf(2);
    });

    it('treats a non-array declaration as an object map', function() {
      const constructed = this.sinon.stub();
      function BehaviorClass() {
        constructed();
      }
      const host = {
        ...BehaviorsMixin,
        behaviors: { 0: BehaviorClass, length: 1 }
      };

      expect(() => host._initBehaviors()).to.throw()
        .with.property('code', 'MN0016');
      expect(constructed).to.have.been.calledOnce;
    });
  });

  [
    ['_getBehaviorTriggers', 'triggers', '_getTriggers'],
    ['_getBehaviorEvents', 'events', '_getEvents']
  ].forEach(([method, type, getMap]) => {
    describe(`#${method}`, function() {
      it(`collects all behavior ${type} before composing own map keys`, function() {
        const calls = [];
        const firstProtoValue = { first: true };
        const secondProtoValue = { second: true };
        const inheritedMap = {};
        Object.defineProperty(inheritedMap, 'inherited', {
          enumerable: true,
          get() {
            throw new Error('inherited map value was read');
          }
        });
        const firstMap = Object.create(inheritedMap);
        Object.defineProperties(firstMap, {
          first: {
            enumerable: true,
            get() {
              calls.push('read:first');
              return 'first';
            }
          },
          shared: {
            enumerable: true,
            get() {
              calls.push('read:first-shared');
              return 'first';
            }
          },
          ['__proto__']: assignmentDescriptor(firstProtoValue)
        });
        firstMap[Symbol('ignored')] = 'ignored';
        const secondMap = {};
        Object.defineProperties(secondMap, {
          shared: {
            enumerable: true,
            get() {
              calls.push('read:second-shared');
              return 'second';
            }
          },
          ['__proto__']: assignmentDescriptor(secondProtoValue)
        });
        const firstBehavior = {
          [getMap]() {
            calls.push('get:first');
            return firstMap;
          }
        };
        const secondBehavior = {
          [getMap]() {
            calls.push('get:second');
            return secondMap;
          }
        };
        const host = { ...BehaviorsMixin, _behaviors: [firstBehavior, secondBehavior] };

        const merged = host[method]();

        expect(calls).to.deep.equal([
          'get:first',
          'get:second',
          'read:first',
          'read:first-shared',
          'read:second-shared'
        ]);
        expect(merged).to.include({ first: 'first', shared: 'second' });
        expect(merged).to.not.have.property('inherited');
        expect(Object.getOwnPropertySymbols(merged)).to.deep.equal([]);
        expect(Object.getPrototypeOf(merged)).to.equal(Object.prototype);
        expect(Object.getOwnPropertyDescriptor(merged, '__proto__'))
          .to.deep.equal(assignmentDescriptor(secondProtoValue));
      });

      it('returns an empty map before behaviors are initialized', function() {
        const host = { ...BehaviorsMixin };

        expect(host[method]()).to.deep.equal({});
      });
    });
  });

  describe('#_triggerEventOnBehaviors', function() {
    it('broadcasts over the initial dense behavior list with exact arguments', function() {
      const calls = [];
      const host = { ...BehaviorsMixin };
      const lateBehavior = {
        triggerMethod() {
          calls.push('late');
        }
      };
      const firstBehavior = {
        triggerMethod(...args) {
          calls.push(['first', this, args]);
          host._behaviors.push(lateBehavior);
          host._behaviors = [];
        }
      };
      const secondBehavior = {
        triggerMethod(...args) {
          calls.push(['second', this, args]);
        }
      };
      host._behaviors = [firstBehavior, secondBehavior];

      host._triggerEventOnBehaviors('event', 'view', 'options');

      expect(calls).to.deep.equal([
        ['first', firstBehavior, ['event', 'view', 'options']],
        ['second', secondBehavior, ['event', 'view', 'options']]
      ]);
    });
  });

  describe('#_setBehaviorElements', function() {
    it('allows element fan-out before behaviors are initialized', function() {
      expect(() => BehaviorsMixin._setBehaviorElements.call({})).to.not.throw();
    });
  });

  describe('#_removeBehavior', function() {
    it('removes every matching identity into a fresh behavior list', function() {
      const removed = {};
      const retained = {};
      const original = [removed, retained, removed];
      const host = { ...BehaviorsMixin, _behaviors: original };

      host._removeBehavior(removed);

      expect(host._behaviors).to.deep.equal([retained]);
      expect(host._behaviors).to.not.equal(original);
      expect(original).to.deep.equal([removed, retained, removed]);
    });
  });
});
