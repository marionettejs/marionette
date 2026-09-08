import { vi, describe, it, expect, beforeEach } from 'vitest';
import _ from 'underscore';
import Backbone from 'backbone';
import { setFixtures } from '../setup/fixtures.js';
import * as Marionette from '../../src/index.ts';
import '../setup/backbone.js';
import $ from 'jquery';

describe('layoutView', function() {
  'use strict';

  beforeEach(function(testContext) {
    testContext.layoutViewManagerTemplateFn = _.template('<div id="regionOne"></div><div id="regionTwo"></div>');
    testContext.template = function() {
      return '<span class=".craft"></span><h1 id="#a-fun-game"></h1>';
    };

    testContext.View = Marionette.View.extend({
      template: testContext.layoutViewManagerTemplateFn,
      regions: {
        regionOne: '#regionOne',
        regionTwo: '#regionTwo'
      },
      initialize: function() {
        if (this.model) {
          this.listenTo(this.model, 'change', this.render);
        }
      },
      onBeforeRender: function() {
        return this.isRendered();
      },
      onRender: function() {
        return this.isRendered();
      }
    });

    testContext.CustomRegion1 = function() {};

    testContext.CustomRegion2 = Marionette.Region.extend();

    testContext.ViewNoDefaultRegion = testContext.View.extend({
      regions: {
        regionOne: {
          selector: '#regionOne',
          regionClass: testContext.CustomRegion1
        },
        regionTwo: '#regionTwo'
      }
    });
  });

  describe('on instantiation', function() {
    beforeEach(function(testContext) {
      let suite = testContext;
      testContext.ViewInitialize = testContext.View.extend({
        initialize: function() {
          suite.regionOne = this.getRegion('regionOne');
        }
      });

      testContext.layoutViewManager = new testContext.ViewInitialize();
    });

    it('should instantiate the specified region before initialize', function(testContext) {
      expect(testContext.regionOne).to.equal(testContext.layoutViewManager.getRegion('regionOne'));
    });

    it('should create backlink with region manager', function(testContext) {
      expect(testContext.regionOne._parentView).to.equal(testContext.layoutViewManager);
    });
  });

  describe('on instantiation with no regions defined', function() {
    beforeEach(function(testContext) {
      let suite = testContext;
      testContext.NoRegions = Marionette.View.extend({});
      testContext.init = function() {
        suite.layoutViewManager = new suite.NoRegions();
      };
    });

    it('should instantiate the specified region managers', function(testContext) {
      expect(testContext.init).not.to.throw;
    });
  });

  describe('on instantiation with custom region managers', function() {
    beforeEach(function(testContext) {
      testContext.ViewCustomRegion = testContext.View.extend({
        regionClass: testContext.CustomRegion1,
        regions: {
          regionOne: {
            el: '#regionOne',
            regionClass: testContext.CustomRegion1
          },
          regionTwo: {
            el: '#regionTwo',
            regionClass: testContext.CustomRegion2,
            specialOption: true
          },
          regionThree: {
            el: '#regionThree'
          },
          regionFour: '#regionFour'
        }
      });

      testContext.layoutViewManager = new testContext.ViewCustomRegion();
    });

    it('should instantiate specific regions with custom regions if specified', function(testContext) {
      expect(testContext.layoutViewManager.getRegion('regionOne')).to.be.instanceof(testContext.CustomRegion1);
      expect(testContext.layoutViewManager.getRegion('regionTwo')).to.be.instanceof(testContext.CustomRegion2);
    });

    it('should instantiate the default regionManager if specified', function(testContext) {
      expect(testContext.layoutViewManager.getRegion('regionThree')).to.be.instanceof(testContext.CustomRegion1);
      expect(testContext.layoutViewManager.getRegion('regionThree')).to.be.instanceof(testContext.CustomRegion1);
    });

    it('should instantiate marionette regions is no regionClass is specified', function(testContext) {
      let layoutViewManagerNoDefault = new testContext.ViewNoDefaultRegion();
      expect(layoutViewManagerNoDefault.getRegion('regionTwo')).to.be.instanceof(Marionette.Region);
    });

    it('should pass extra options to the custom regionClass', function(testContext) {
      expect(testContext.layoutViewManager.getRegion('regionTwo')).to.have.property('options');
      expect(testContext.layoutViewManager.getRegion('regionTwo').options).to.have.property('specialOption');
      expect(testContext.layoutViewManager.getRegion('regionTwo').options.specialOption).to.be.ok;
    });
  });

  describe('when regions are defined as a function', function() {
    beforeEach(function(testContext) {
      const View = testContext.View.extend({
        regions: function() {
          return {
            regionOne: '#regionOne',
            regionTwo: '#regionTwo'
          };
        }
      });

      testContext.layoutView = new View();
      testContext.layoutView.render();
    });

    it('should build the regions from the returns object literal', function(testContext) {
      expect(testContext.layoutView.getRegion('regionOne')).to.be.instanceof(Marionette.Region);
    });
  });

  describe('on rendering', function() {
    beforeEach(function(testContext) {
      testContext.layoutViewManager = new testContext.View();
      vi.spyOn(testContext.layoutViewManager, 'onRender');
      vi.spyOn(testContext.layoutViewManager, 'onBeforeRender');
      vi.spyOn(testContext.layoutViewManager, 'trigger');
      testContext.layoutViewManager.render();
    });

    it('should find the region scoped within the rendered template', function(testContext) {
      testContext.layoutViewManager.getRegion('regionOne')._ensureElement();
      let el = testContext.layoutViewManager.$('#regionOne');
      expect(testContext.layoutViewManager.getRegion('regionOne').el).to.equal(el[0]);
    });

    it('should call "onBeforeRender" before rendering', function(testContext) {
      expect(testContext.layoutViewManager.onBeforeRender).toHaveBeenCalledTimes(1);
    });

    it('should call "onRender" after rendering', function(testContext) {
      expect(testContext.layoutViewManager.onRender).toHaveBeenCalledTimes(1);
    });

    it('should call "onBeforeRender" before "onRender"', function(testContext) {
      expect(testContext.layoutViewManager.onBeforeRender).toHaveBeenCalledBefore(testContext.layoutViewManager.onRender);
    });

    it('should not be rendered when "onBeforeRender" is called', function(testContext) {
      expect(testContext.layoutViewManager.onBeforeRender.mock.results.at(-1).value).not.to.be.ok;
    });

    it('should be rendered when "onRender" is called', function(testContext) {
      expect(testContext.layoutViewManager.onRender.mock.results.at(-1).value).to.be.true;
    });

    it('should trigger a "before:render" event', function(testContext) {
      expect(testContext.layoutViewManager.trigger.mock.calls.map(args => args.slice(0, 2))).toContainEqual(['before:render', testContext.layoutViewManager]);
    });

    it('should trigger a "render" event', function(testContext) {
      expect(testContext.layoutViewManager.trigger.mock.calls.map(args => args.slice(0, 2))).toContainEqual(['render', testContext.layoutViewManager]);
    });

    it('should be marked rendered', function(testContext) {
      expect(testContext.layoutViewManager).to.have.property('_isRendered', true);
    });
  });

  describe('when destroying', function() {

    beforeEach(function(testContext) {
      testContext.layoutViewManager = new testContext.View();
      $('<span id="parent">').append(testContext.layoutViewManager.el);
      testContext.layoutViewManager.render();

      testContext.regionOne = testContext.layoutViewManager.getRegion('regionOne');
      testContext.regionTwo = testContext.layoutViewManager.getRegion('regionTwo');

      const View = Marionette.View.extend({
        template: _.noop,
        destroy: function() {
          this.hadParent = Boolean(this.el.closest('#parent'));
          return View.__super__.destroy.call(this);
        }
      });

      testContext.regionOneView = new View();
      vi.spyOn(testContext.regionOne, 'empty');
      vi.spyOn(testContext.regionTwo, 'empty');

      testContext.regionOne.show(testContext.regionOneView);

      vi.spyOn(testContext.layoutViewManager, 'destroy');
      testContext.layoutViewManager.destroy();
      testContext.layoutViewManager.destroy();
    });

    it('should empty the region managers', function(testContext) {
      expect(testContext.regionOne.empty).toHaveBeenCalledTimes(2);
      expect(testContext.regionTwo.empty).toHaveBeenCalledTimes(1);
    });

    it('should delete the region managers', function(testContext) {
      expect(testContext.layoutViewManager.getRegion('regionOne')).to.be.undefined;
      expect(testContext.layoutViewManager.getRegion('regionTwo')).to.be.undefined;
    });

    it('should return the view', function(testContext) {
      expect(testContext.layoutViewManager.destroy.mock.results).toEqual(Array(testContext.layoutViewManager.destroy.mock.results.length).fill({ type: 'return', value: testContext.layoutViewManager }));
    });

    it('should remove itself from the DOM before destroying child regions by default', function(testContext) {
      expect(testContext.regionOneView.hadParent).to.be.false;
    });

    it('should be marked destroyed', function(testContext) {
      expect(testContext.layoutViewManager).to.have.property('_isDestroyed', true);
    });

    it('should be marked not rendered', function(testContext) {
      expect(testContext.layoutViewManager).to.have.property('_isRendered', false);
    });
  });


  describe('when using showChildView with options', function() {
    let options = {myOption: 'some value'};

    beforeEach(function(testContext) {
      const BBView = Marionette.View.extend({ template: () => '' });
      _.extend(BBView.prototype, Marionette.Events);

      testContext.layoutView = new testContext.View().render();
      testContext.regionOne = testContext.layoutView.getRegion('regionOne');
      testContext.childView = new BBView();
      vi.spyOn(testContext.regionOne, 'show');
      testContext.layoutView.showChildView('regionOne', testContext.childView, options);
    });

    it('passes the options hash to the region', function(testContext) {
      expect(testContext.regionOne.show).toHaveBeenCalledTimes(1);
      expect(testContext.regionOne.show.mock.calls.map(args => args.slice(0, 2))).toContainEqual([testContext.childView, options]);
    });
  });

  describe('when showing a childView as a View', function() {
    beforeEach(function(testContext) {
      testContext.layoutView = new testContext.View();
      testContext.childEventsHandlerTrigger = vi.fn();
      testContext.childEventsHandlerTriggerMethod = vi.fn();

      // add child events to listen for
      testContext.layoutView.childViewEvents = {
        'before:content:rendered': testContext.childEventsHandlerTrigger,
        'content:rendered': testContext.childEventsHandlerTriggerMethod
      };
      testContext.layoutView._buildEventProxies();
      testContext.layoutView.render();

      // create a child view which triggers an event on render
      let ChildView = Marionette.View.extend({
        template: _.noop,
        onBeforeRender: function() {
          this.trigger('before:content:rendered');
        },
        onRender: function() {
          this.triggerMethod('content:rendered');
        }
      });
      testContext.childView = new ChildView();

      testContext.layoutView.showChildView('regionOne', testContext.childView);
    });

    it('shows the childview in the region', function(testContext) {
      expect(testContext.layoutView.getChildView('regionOne')).to.equal(testContext.childView);
    });

    it('childViewEvents are triggered', function(testContext) {
      expect(testContext.childEventsHandlerTrigger).toHaveBeenCalledTimes(1);
    });

    it('childViewEvents are triggered', function(testContext) {
      expect(testContext.childEventsHandlerTriggerMethod).toHaveBeenCalledTimes(1);
    });

    describe('and the view is detached', function() {
      beforeEach(function(testContext) {
        testContext.detachedView = testContext.layoutView.detachChildView('regionOne');
        testContext.noDetachedView = testContext.layoutView.detachChildView('regionOne');
      });

      it('should return the childView it was given', function(testContext) {
        expect(testContext.detachedView).to.equal(testContext.childView);
      });

      it('should not return a childView if it was already detached', function(testContext) {
        expect(testContext.noDetachedView).to.be.undefined;
      });
    });
  });

  describe('when showing a layoutView via a region', function() {
    beforeEach(function(testContext) {
      let suite = testContext;

      setFixtures('<div id="mgr"></div>');

      testContext.layoutView = new testContext.View();
      testContext.layoutView.onRender = function() {
        suite.regionOne = suite.layoutView.getRegion('regionOne');
        suite.regionOne._ensureElement();
      };

      testContext.region = new Marionette.Region({
        el: '#mgr'
      });

      testContext.showReturn = testContext.region.show(testContext.layoutView);
    });

    it('should make the regions available in `onRender`', function(testContext) {
      expect(testContext.regionOne).to.exist;
    });

    it('the regions should find their elements in `onRender`', function(testContext) {
      expect(testContext.regionOne.el).to.exist;
    });

    it('should return the region after showing a view in a region', function(testContext) {
      expect(testContext.showReturn).to.equal(testContext.region);
    });
  });

  describe('when destroying a childView as a View', function() {
    beforeEach(function(testContext) {
      testContext.childEventsHandler = vi.fn();
      testContext.layoutView = new testContext.View({
        childViewEvents: {
          'destroy': testContext.childEventsHandler
        }
      });

      testContext.layoutView.render();

      // create a child view which triggers an event on render
      let ChildView = Marionette.View.extend({
        template: _.noop
      });
      testContext.childView = new ChildView();

      testContext.layoutView.showChildView('regionOne', testContext.childView);
      testContext.childView.destroy();
    });

    it('childViewEvents "destroy" method is triggered', function(testContext) {
      expect(testContext.childEventsHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('when destroying the childView destroys the parent', function() {
    let layoutView;

    beforeEach(function() {
      const LayoutView = Marionette.View.extend({
        childViewEvents: {
          'destroy': 'destroy'
        },
        template: _.template('<div id="regionOne"></div>'),
        regions: {
          regionOne: '#regionOne'
        }
      });

      layoutView = new LayoutView();

      const childView = new Marionette.View({
        template: _.noop
      });

      layoutView.showChildView('regionOne', childView);
    });

    it('should not throw any errors', function() {
      expect(function() { layoutView.destroy(); }).to.not.throw();
    });
  });

  describe('when re-rendering an already rendered layoutView', function() {
    beforeEach(function(testContext) {
      const BBView = Marionette.View.extend({ template: () => '' });
      _.extend(BBView.prototype, Marionette.Events);

      testContext.ViewBoundRender = testContext.View.extend({
        initialize: function() {
          if (this.model) {
            this.listenTo(this.model, 'change', this.render);
          }
        }
      });

      testContext.layoutView = new testContext.ViewBoundRender({
        model: new Backbone.Model()
      });
      testContext.layoutView.render();

      vi.spyOn(testContext.layoutView.getRegion('regionOne'), 'empty');
      testContext.view = new BBView();
      testContext.view.destroy = function() {};
      testContext.layoutView.getRegion('regionOne').show(testContext.view);

      testContext.layoutView.render();
      testContext.layoutView.getRegion('regionOne').show(testContext.view);
      testContext.region = testContext.layoutView.getRegion('regionOne');
    });

    it('should re-bind the regions to the newly rendered elements', function(testContext) {
      expect(testContext.region.el.parentNode).to.equal(testContext.layoutView.el);
    });

    it('triggers "before:render" before emptying the regions', function(testContext) {
      let cb = function() {
        expect(this.region.el).to.exist;
      };
      testContext.layoutView.listenTo(testContext.layoutView, 'before:render', cb.bind(testContext));
      testContext.layoutView.render();
    });

    it('should call empty twice', function(testContext) {
      expect(testContext.region.empty).toHaveBeenCalledTimes(3);
    });

    describe('and the views "render" function is bound to an event in the "initialize" function', function() {
      beforeEach(function(testContext) {
        let suite = testContext;
        testContext.layoutView.onRender = function() {
          this.getRegion('regionOne').show(suite.view);
        };

        testContext.layoutView.model.trigger('change');
      });

      it('should re-bind the regions correctly', function(testContext) {
        expect(testContext.layoutView.$('#regionOne')).not.to.equal();
      });
    });
  });

  describe('when getting a region', function() {
    beforeEach(function(testContext) {
      testContext.layoutView = new testContext.View();
      testContext.region = testContext.layoutView.getRegion('regionOne');
    });

    it('should return the region', function(testContext) {
      expect(testContext.layoutView.getRegion('regionOne')).to.equal(testContext.region);
    });
  });

  describe('when adding regions in a layoutViews options', function() {
    beforeEach(function(testContext) {
      let suite = testContext;

      testContext.CustomRegion = vi.fn();
      testContext.regionOptions = {
        war: '.craft',
        is: {
          regionClass: testContext.CustomRegion,
          selector: '#a-fun-game'
        }
      };

      testContext.layoutView = new Marionette.View({
        template: testContext.template,
        regions: testContext.regionOptions
      });

      testContext.layoutView2 = new Marionette.View({
        template: testContext.template,
        regions: function() {
          return suite.regionOptions;
        }
      });
    });

    it('should lookup and set the regions', function(testContext) {
      expect(testContext.layoutView.getRegion('is')).to.exist;
      expect(testContext.layoutView.getRegion('war')).to.exist;
    });

    it('should lookup and set the regions when passed a function', function(testContext) {
      expect(testContext.layoutView2.getRegion('is')).to.exist;
      expect(testContext.layoutView2.getRegion('war')).to.exist;
    });

    it('should set custom region classes', function(testContext) {
      expect(testContext.CustomRegion).toHaveBeenCalled();
    });
  });

  describe('when defining region selectors using @ui. syntax', function() {
    beforeEach(function(testContext) {
      let UIView = Marionette.View.extend({
        template: testContext.template,
        regions: {
          war: '@ui.war',
          mario: {
            el: '@ui.mario'
          },
          princess: {
            el: '@ui.princess'
          }
        },
        ui: {
          war: '.craft',
          mario: '.bros',
          princess: '.toadstool'
        }
      });
      testContext.layoutView = new UIView();
    });

    it('should apply the relevant @ui. syntax selector to a simple string value', function(testContext) {
      expect(testContext.layoutView.getRegion('war')).to.exist;
    });
    it('should apply the relevant @ui. syntax selector to selector in a region definition object', function(testContext) {
      expect(testContext.layoutView.getRegion('mario')).to.exist;
    });
    it('should apply the relevant @ui. syntax selector to el in a region definition object', function(testContext) {
      expect(testContext.layoutView.getRegion('princess')).to.exist;
    });
  });

  describe('when a layout has regions', function() {
    beforeEach(function(testContext) {
      testContext.layout = new testContext.View();
    });

    it('should be able to retrieve all regions', function(testContext) {
      testContext.layout.render();
      testContext.regions = testContext.layout.getRegions();
      expect(testContext.regions.regionOne).to.equal(testContext.layout.getRegion('regionOne'));
      expect(testContext.regions.regionTwo).to.equal(testContext.layout.getRegion('regionTwo'));
    });

    describe('when the regions are specified via regions hash and the view has no template', function() {
      beforeEach(function(testContext) {
        let fixture =
          '<div class="region-hash-no-template-spec">' +
            '<div class="region-one">Out-of-scope region</div>' +
            '<div class="some-layout-view">' +
              '<div class="region-one">In-scope region</div>' +
            '</div>' +
          '</div>';
        setFixtures(fixture);
        testContext.layout.render();
        testContext.regions = testContext.layout.getRegions();
        testContext.View = Marionette.View.extend({
          el: function() {
            return document.querySelector('.region-hash-no-template-spec .some-layout-view');
          },
          template: _.noop,
          regions: {
            regionOne: '.region-one'
          }
        });
        testContext.layoutViewInstance = new testContext.View();
        let $specNode = $('.region-hash-no-template-spec');
        testContext.$inScopeRegion = $specNode.find('.some-layout-view .region-one');
        testContext.$outOfScopeRegion = $specNode.children('.region-one');
      });

      it('after initialization, the view\'s regions should be scoped to its parent view', function(testContext) {
        const region = testContext.layoutViewInstance.getRegion('regionOne');
        region._ensureElement();
        const regionEl = region.el;
        expect(regionEl).to.exist;
        expect(regionEl).to.equal(testContext.$inScopeRegion[0]);
        expect(regionEl).to.not.equal(testContext.$outOfScopeRegion[0]);
      });
    });
  });

  describe('manipulating regions', function() {
    beforeEach(function(testContext) {
      testContext.beforeAddRegionSpy = vi.fn();
      testContext.addRegionSpy = vi.fn();
      testContext.beforeRegionRemoveSpy = vi.fn();
      testContext.removeRegionSpy = vi.fn();

      testContext.Layout = Marionette.View.extend({
        template: _.noop,
        onBeforeAddRegion: testContext.beforeAddRegionSpy,
        onAddRegion: testContext.addRegionSpy,
        onBeforeRemoveRegion: testContext.beforeRegionRemoveSpy,
        onRemoveRegion: testContext.removeRegionSpy
      });

      testContext.layout = new testContext.Layout();

      testContext.regionName = 'myRegion';
      testContext.layout.addRegion(testContext.regionName, '.region-selector');
    });

    it('should trigger correct region add events', function(testContext) {
      expect(testContext.beforeAddRegionSpy).toHaveBeenCalledTimes(1);
      expect(testContext.beforeAddRegionSpy.mock.contexts).toContain(testContext.layout);
      expect(testContext.beforeAddRegionSpy.mock.calls.map(args => args.slice(0, 2))).toContainEqual([testContext.layout, testContext.regionName]);

      expect(testContext.addRegionSpy).toHaveBeenCalledTimes(1);
      expect(testContext.addRegionSpy.mock.contexts).toContain(testContext.layout);
      expect(testContext.addRegionSpy.mock.calls.map(args => args.slice(0, 2))).toContainEqual([testContext.layout, testContext.regionName]);
    });

    it('should trigger correct region remove events', function(testContext) {
      testContext.layout.removeRegion(testContext.regionName);

      expect(testContext.beforeRegionRemoveSpy).toHaveBeenCalledTimes(1);
      expect(testContext.beforeRegionRemoveSpy.mock.contexts).toContain(testContext.layout);
      expect(testContext.beforeRegionRemoveSpy.mock.calls.map(args => args.slice(0, 2))).toContainEqual([testContext.layout, testContext.regionName]);

      expect(testContext.removeRegionSpy).toHaveBeenCalledTimes(1);
      expect(testContext.removeRegionSpy.mock.contexts).toContain(testContext.layout);
      expect(testContext.removeRegionSpy.mock.calls.map(args => args.slice(0, 2))).toContainEqual([testContext.layout, testContext.regionName]);
    });
  });

});
