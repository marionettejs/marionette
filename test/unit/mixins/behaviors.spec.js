import { vi, describe, it, expect, beforeEach } from 'vitest';
import '../../setup/backbone.js';
'use strict';

import _ from 'underscore';
import Backbone from 'backbone';
import BehaviorsMixin from '../../../src/mixins/behaviors';
import Behavior from '../../../src/modules/behavior';

describe('Behaviors Mixin', function() {
  let Behaviors;

  beforeEach(function() {
    Behaviors = Backbone.View.extend();
    _.extend(Behaviors.prototype, BehaviorsMixin);
  });

  describe('#_initBehaviors', function() {
    let behaviorsInstance;
    let fooInitializeStub;
    let FooBehavior;

    beforeEach(function() {
      fooInitializeStub = vi.fn();
      behaviorsInstance = new Behaviors();
      FooBehavior = Behavior.extend({initialize: fooInitializeStub});
    });

    describe('with no behaviors', function() {
      it('should not have behaviors', function() {
        behaviorsInstance._initBehaviors();

        expect(behaviorsInstance._behaviors).to.be.deep.equal([]);
      });
    });

    describe('with behaviorClass option', function() {
      beforeEach(function() {
        behaviorsInstance.behaviors = [
          {
            behaviorClass: FooBehavior
          }
        ];
        behaviorsInstance._initBehaviors();
      });

      it('should call initialize when a behavior is created', function() {
        expect(fooInitializeStub).toHaveBeenCalledTimes(1);
      });

      it('should have behaviors', function() {
        expect(behaviorsInstance._behaviors).to.have.lengthOf(1);
      });
    });

    describe('without behaviorClass option', function() {
      beforeEach(function() {
        behaviorsInstance.behaviors = [FooBehavior];
        behaviorsInstance._initBehaviors();
      });

      it('should call initialize when a behavior is created', function() {
        expect(fooInitializeStub).toHaveBeenCalledTimes(1);
      });

      it('should have behaviors', function() {
        expect(behaviorsInstance._behaviors).to.have.lengthOf(1);
      });
    });

    describe('with nested behaviors', function() {
      let barInitializeStub;
      let bazInitializeStub;

      beforeEach(function() {
        barInitializeStub = vi.fn();
        bazInitializeStub = vi.fn();

        let BarBehavior = Behavior.extend({
          initialize: barInitializeStub,
        });

        FooBehavior = Behavior.extend({
          initialize: fooInitializeStub,
          behaviors: [BarBehavior]
        });

        behaviorsInstance.behaviors = [FooBehavior];

        behaviorsInstance._initBehaviors();
      });

      it('should call initialize when a behavior is created', function() {
        expect(fooInitializeStub).toHaveBeenCalledTimes(1);
        expect(bazInitializeStub).not.toHaveBeenCalled();
      });

      it('should call initialize when a nested behavior is created', function() {
        expect(barInitializeStub).toHaveBeenCalledTimes(1);
      });

      it('should have behaviors', function() {
        expect(behaviorsInstance._behaviors).to.have.lengthOf(2);
      });
    });

    describe('with nested behaviors and without behaviorsLookup', function() {
      let barInitializeStub;

      beforeEach(function() {
        barInitializeStub = vi.fn();

        let BarBehavior = Behavior.extend({
          initialize: barInitializeStub,
        });

        FooBehavior = Behavior.extend({
          initialize: fooInitializeStub,
          behaviors: [BarBehavior]
        });

        behaviorsInstance.behaviors = {foo: FooBehavior};
        behaviorsInstance._initBehaviors();
      });

      it('should call initialize when a behavior is created', function() {
        expect(fooInitializeStub).toHaveBeenCalledTimes(1);
      });

      it('should call initialize when a nested behavior is created', function() {
        expect(barInitializeStub).toHaveBeenCalledTimes(1);
      });

      it('should have behaviors', function() {
        expect(behaviorsInstance._behaviors).to.have.lengthOf(2);
      });
    });

  });

  describe('#_delegateBehaviorEntityEvents', function() {
    let behaviorsInstance;
    let FooBehavior;
    let BarBehavior;

    beforeEach(function() {
      behaviorsInstance = new Behaviors();
      FooBehavior = Behavior.extend({});
      BarBehavior = Behavior.extend({});

      vi.spyOn(FooBehavior.prototype, 'delegateEntityEvents');
      vi.spyOn(BarBehavior.prototype, 'delegateEntityEvents');

      behaviorsInstance.behaviors = {foo: FooBehavior, bar: BarBehavior};
      behaviorsInstance._initBehaviors();
    });

    it('should invoke delegateEntityEvents', function() {
      behaviorsInstance._delegateBehaviorEntityEvents();

      expect(FooBehavior.prototype.delegateEntityEvents).toHaveBeenCalledTimes(1);
      expect(BarBehavior.prototype.delegateEntityEvents).toHaveBeenCalledTimes(1);
    });
  });

  describe('#_undelegateBehaviorEntityEvents', function() {
    let behaviorsInstance;
    let FooBehavior;
    let BarBehavior;

    beforeEach(function() {
      behaviorsInstance = new Behaviors();
      FooBehavior = Behavior.extend({});
      BarBehavior = Behavior.extend({});

      vi.spyOn(FooBehavior.prototype, 'undelegateEntityEvents').mockImplementation(() => undefined);
      vi.spyOn(BarBehavior.prototype, 'undelegateEntityEvents').mockImplementation(() => undefined);

      behaviorsInstance.behaviors = {foo: FooBehavior, bar: BarBehavior};
      behaviorsInstance._initBehaviors();
    });

    it('should invoke undelegateEntityEvents', function() {
      behaviorsInstance._undelegateBehaviorEntityEvents();

      expect(FooBehavior.prototype.undelegateEntityEvents).toHaveBeenCalledTimes(1);
      expect(BarBehavior.prototype.undelegateEntityEvents).toHaveBeenCalledTimes(1);
    });

    it('should finish the original Behavior snapshot when one removes itself', function() {
      const fooBehavior = behaviorsInstance._behaviors[0];
      FooBehavior.prototype.undelegateEntityEvents.mockImplementation(() => {
        behaviorsInstance._removeBehavior(fooBehavior);
      });

      behaviorsInstance._undelegateBehaviorEntityEvents();

      expect(FooBehavior.prototype.undelegateEntityEvents).toHaveBeenCalledTimes(1);
      expect(BarBehavior.prototype.undelegateEntityEvents).toHaveBeenCalledTimes(1);
    });

    it('should allow rollback before Behaviors are initialized', function() {
      delete behaviorsInstance._behaviors;

      expect(() => behaviorsInstance._undelegateBehaviorEntityEvents()).to.not.throw();
    });
  });

  describe('#_destroyBehaviors', function() {
    let behaviorsInstance;
    let FooBehavior;
    let BarBehavior;

    beforeEach(function() {
      behaviorsInstance = new Behaviors();
      FooBehavior = Behavior.extend({});
      BarBehavior = Behavior.extend({});

      vi.spyOn(FooBehavior.prototype, 'destroy').mockImplementation(() => undefined);
      vi.spyOn(BarBehavior.prototype, 'destroy').mockImplementation(() => undefined);

      behaviorsInstance.behaviors = {foo: FooBehavior, bar: BarBehavior};
      behaviorsInstance._initBehaviors();
    });

    it('should invoke destroy with options argument', function() {
      behaviorsInstance._destroyBehaviors({foo: 'bar'});

      expect(FooBehavior.prototype.destroy).toHaveBeenCalledTimes(1);
      expect(FooBehavior.prototype.destroy.mock.calls.map(args => args.slice(0, 1))).toContainEqual([{foo: 'bar'}]);
      expect(BarBehavior.prototype.destroy).toHaveBeenCalledTimes(1);
      expect(BarBehavior.prototype.destroy.mock.calls.map(args => args.slice(0, 1))).toContainEqual([{foo: 'bar'}]);
    });

    it('should invoke destroy without arguments', function() {
      behaviorsInstance._destroyBehaviors();

      expect(FooBehavior.prototype.destroy).toHaveBeenCalledTimes(1);
      expect(BarBehavior.prototype.destroy).toHaveBeenCalledTimes(1);
    });

    it('should allow teardown before Behaviors are initialized', function() {
      delete behaviorsInstance._behaviors;

      expect(() => behaviorsInstance._destroyBehaviors()).to.not.throw();
    });
  });

  describe('#_removeBehavior', function() {
    let behaviorsInstance;
    let FooBehavior;
    let BarBehavior;

    beforeEach(function() {
      behaviorsInstance = new Behaviors();
      FooBehavior = Behavior.extend({});
      BarBehavior = Behavior.extend({});

      behaviorsInstance.behaviors = {foo: FooBehavior, bar: BarBehavior};
      behaviorsInstance._initBehaviors();
    });

    it('should remove the behavior from the view\'s behaviors', function() {
      const behaviorInstance = behaviorsInstance._behaviors[0];

      behaviorsInstance._removeBehavior(behaviorInstance);

      expect(behaviorsInstance._behaviors).to.have.lengthOf(1).and.not.to.include(behaviorInstance);
    });

    describe('when the view is destroyed', function() {
      it('should not remove the behavior', function() {
        // behaviorsInstance is not an actual view so simulate destroy
        behaviorsInstance._isDestroyed = true;

        const behaviorInstance = behaviorsInstance._behaviors[0];

        behaviorsInstance._removeBehavior(behaviorInstance);

        expect(behaviorsInstance._behaviors).to.have.lengthOf(2).to.include(behaviorInstance);
      });
    });
  });

  describe('#_bindBehaviorUIElements', function() {
    let behaviorsInstance;
    let FooBehavior;
    let BarBehavior;

    beforeEach(function() {
      behaviorsInstance = new Behaviors();
      FooBehavior = Behavior.extend({});
      BarBehavior = Behavior.extend({});

      vi.spyOn(FooBehavior.prototype, 'bindUIElements');
      vi.spyOn(BarBehavior.prototype, 'bindUIElements');

      behaviorsInstance.behaviors = {foo: FooBehavior, bar: BarBehavior};
      behaviorsInstance._initBehaviors();
    });

    it('should invoke bindUIElements', function() {
      behaviorsInstance._bindBehaviorUIElements();

      expect(FooBehavior.prototype.bindUIElements).toHaveBeenCalledTimes(1);
      expect(BarBehavior.prototype.bindUIElements).toHaveBeenCalledTimes(1);
    });
  });

  describe('#_unbindBehaviorUIElements', function() {
    let behaviorsInstance;
    let FooBehavior;
    let BarBehavior;

    beforeEach(function() {
      behaviorsInstance = new Behaviors();
      FooBehavior = Behavior.extend({});
      BarBehavior = Behavior.extend({});

      vi.spyOn(FooBehavior.prototype, 'unbindUIElements');
      vi.spyOn(BarBehavior.prototype, 'unbindUIElements');

      behaviorsInstance.behaviors = {foo: FooBehavior, bar: BarBehavior};
      behaviorsInstance._initBehaviors();
    });

    it('should invoke unbindUIElements', function() {
      behaviorsInstance._unbindBehaviorUIElements();

      expect(FooBehavior.prototype.unbindUIElements).toHaveBeenCalledTimes(1);
      expect(BarBehavior.prototype.unbindUIElements).toHaveBeenCalledTimes(1);
    });
  });

  describe('#_triggerEventOnBehaviors', function() {
    let behaviorsInstance;
    let FooBehavior;
    let BarBehavior;

    beforeEach(function() {
      behaviorsInstance = new Behaviors();
      FooBehavior = Behavior.extend({
        onFoo: vi.fn()
      });
      BarBehavior = Behavior.extend({
        onFoo: vi.fn()
      });

      behaviorsInstance.behaviors = {foo: FooBehavior, bar: BarBehavior};
      behaviorsInstance._initBehaviors();
    });

    it('should invoke events', function() {
      behaviorsInstance._triggerEventOnBehaviors('foo', 'view', 'options');

      expect(FooBehavior.prototype.onFoo).toHaveBeenCalledTimes(1);
      expect(FooBehavior.prototype.onFoo.mock.calls.map(args => args.slice(0, 2))).toContainEqual(['view', 'options']);
      expect(BarBehavior.prototype.onFoo).toHaveBeenCalledTimes(1);
      expect(BarBehavior.prototype.onFoo.mock.calls.map(args => args.slice(0, 2))).toContainEqual(['view', 'options']);
    });
  });
});
