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
      fooInitializeStub = this.sinon.stub();
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
        expect(fooInitializeStub).to.be.calledOnce;
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
        expect(fooInitializeStub).to.be.calledOnce;
      });

      it('should have behaviors', function() {
        expect(behaviorsInstance._behaviors).to.have.lengthOf(1);
      });
    });

    describe('with nested behaviors', function() {
      let barInitializeStub;
      let bazInitializeStub;

      beforeEach(function() {
        barInitializeStub = this.sinon.stub();
        bazInitializeStub = this.sinon.stub();

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
        expect(fooInitializeStub).to.be.calledOnce;
        expect(bazInitializeStub).not.to.have.been.called;
      });

      it('should call initialize when a nested behavior is created', function() {
        expect(barInitializeStub).to.be.calledOnce;
      });

      it('should have behaviors', function() {
        expect(behaviorsInstance._behaviors).to.have.lengthOf(2);
      });
    });

    describe('with nested behaviors and without behaviorsLookup', function() {
      let barInitializeStub;

      beforeEach(function() {
        barInitializeStub = this.sinon.stub();

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
        expect(fooInitializeStub).to.be.calledOnce;
      });

      it('should call initialize when a nested behavior is created', function() {
        expect(barInitializeStub).to.be.calledOnce;
      });

      it('should have behaviors', function() {
        expect(behaviorsInstance._behaviors).to.have.lengthOf(2);
      });
    });

    describe('with invalid option', function() {
      beforeEach(function() {
        behaviorsInstance.behaviors = [{foo: 'bar'}];
      });

      it('should throw an error', function() {
        expect(function() {
          behaviorsInstance._initBehaviors()
        }).to.throw('Unable to get behavior class. A Behavior constructor should be passed directly or as behaviorClass property of options')
          .with.property('code', 'MN0016');
      });
    })
  });

  describe('#_delegateBehaviorEntityEvents', function() {
    let behaviorsInstance;
    let FooBehavior;
    let BarBehavior;

    beforeEach(function() {
      behaviorsInstance = new Behaviors();
      FooBehavior = Behavior.extend({});
      BarBehavior = Behavior.extend({});

      this.sinon.spy(FooBehavior.prototype, 'delegateEntityEvents');
      this.sinon.spy(BarBehavior.prototype, 'delegateEntityEvents');

      behaviorsInstance.behaviors = {foo: FooBehavior, bar: BarBehavior};
      behaviorsInstance._initBehaviors();
    });

    it('should invoke delegateEntityEvents', function() {
      behaviorsInstance._delegateBehaviorEntityEvents();

      expect(FooBehavior.prototype.delegateEntityEvents).to.have.been.calledOnce;
      expect(BarBehavior.prototype.delegateEntityEvents).to.have.been.calledOnce;
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

      this.sinon.stub(FooBehavior.prototype, 'undelegateEntityEvents');
      this.sinon.stub(BarBehavior.prototype, 'undelegateEntityEvents');

      behaviorsInstance.behaviors = {foo: FooBehavior, bar: BarBehavior};
      behaviorsInstance._initBehaviors();
    });

    it('should invoke undelegateEntityEvents', function() {
      behaviorsInstance._undelegateBehaviorEntityEvents();

      expect(FooBehavior.prototype.undelegateEntityEvents).to.have.been.calledOnce;
      expect(BarBehavior.prototype.undelegateEntityEvents).to.have.been.calledOnce;
    });

    it('should attempt every Behavior before rethrowing the first error', function() {
      const error = new Error('foo undelegate failed');
      FooBehavior.prototype.undelegateEntityEvents.throws(error);
      BarBehavior.prototype.undelegateEntityEvents.throws(new Error('bar undelegate failed'));

      expect(() => behaviorsInstance._undelegateBehaviorEntityEvents()).to.throw(error);
      expect(FooBehavior.prototype.undelegateEntityEvents).to.have.been.calledOnce;
      expect(BarBehavior.prototype.undelegateEntityEvents).to.have.been.calledOnce;
    });

    it('should finish the original Behavior snapshot when one removes itself', function() {
      const fooBehavior = behaviorsInstance._behaviors[0];
      FooBehavior.prototype.undelegateEntityEvents.callsFake(() => {
        behaviorsInstance._removeBehavior(fooBehavior);
      });

      behaviorsInstance._undelegateBehaviorEntityEvents();

      expect(FooBehavior.prototype.undelegateEntityEvents).to.have.been.calledOnce;
      expect(BarBehavior.prototype.undelegateEntityEvents).to.have.been.calledOnce;
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

      this.sinon.stub(FooBehavior.prototype, 'destroy');
      this.sinon.stub(BarBehavior.prototype, 'destroy');

      behaviorsInstance.behaviors = {foo: FooBehavior, bar: BarBehavior};
      behaviorsInstance._initBehaviors();
    });

    it('should invoke destroy with options argument', function() {
      behaviorsInstance._destroyBehaviors({foo: 'bar'});

      expect(FooBehavior.prototype.destroy)
        .to.have.been.calledOnce.and.calledWith({foo: 'bar'});
      expect(BarBehavior.prototype.destroy)
        .to.have.been.calledOnce.and.calledWith({foo: 'bar'});
    });

    it('should invoke destroy without arguments', function() {
      behaviorsInstance._destroyBehaviors();

      expect(FooBehavior.prototype.destroy).to.have.been.calledOnce;
      expect(BarBehavior.prototype.destroy).to.have.been.calledOnce;
    });

    it('should attempt every destroy before rethrowing the first error', function() {
      const error = new Error('foo destroy failed');
      FooBehavior.prototype.destroy.throws(error);
      BarBehavior.prototype.destroy.throws(new Error('bar destroy failed'));

      expect(() => behaviorsInstance._destroyBehaviors()).to.throw(error);
      expect(FooBehavior.prototype.destroy).to.have.been.calledOnce;
      expect(BarBehavior.prototype.destroy).to.have.been.calledOnce;
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

      this.sinon.spy(FooBehavior.prototype, 'bindUIElements');
      this.sinon.spy(BarBehavior.prototype, 'bindUIElements');

      behaviorsInstance.behaviors = {foo: FooBehavior, bar: BarBehavior};
      behaviorsInstance._initBehaviors();
    });

    it('should invoke bindUIElements', function() {
      behaviorsInstance._bindBehaviorUIElements();

      expect(FooBehavior.prototype.bindUIElements).to.have.been.calledOnce;
      expect(BarBehavior.prototype.bindUIElements).to.have.been.calledOnce;
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

      this.sinon.spy(FooBehavior.prototype, 'unbindUIElements');
      this.sinon.spy(BarBehavior.prototype, 'unbindUIElements');

      behaviorsInstance.behaviors = {foo: FooBehavior, bar: BarBehavior};
      behaviorsInstance._initBehaviors();
    });

    it('should invoke unbindUIElements', function() {
      behaviorsInstance._unbindBehaviorUIElements();

      expect(FooBehavior.prototype.unbindUIElements).to.have.been.calledOnce;
      expect(BarBehavior.prototype.unbindUIElements).to.have.been.calledOnce;
    });
  });

  describe('#_triggerEventOnBehaviors', function() {
    let behaviorsInstance;
    let FooBehavior;
    let BarBehavior;

    beforeEach(function() {
      behaviorsInstance = new Behaviors();
      FooBehavior = Behavior.extend({
        onFoo: this.sinon.stub()
      });
      BarBehavior = Behavior.extend({
        onFoo: this.sinon.stub()
      });

      behaviorsInstance.behaviors = {foo: FooBehavior, bar: BarBehavior};
      behaviorsInstance._initBehaviors();
    });

    it('should invoke events', function() {
      behaviorsInstance._triggerEventOnBehaviors('foo', 'view', 'options');

      expect(FooBehavior.prototype.onFoo)
        .to.have.been.calledOnce
        .and.calledWith('view', 'options');
      expect(BarBehavior.prototype.onFoo)
        .to.have.been.calledOnce
        .and.calledWith('view', 'options');
    });
  });
});
