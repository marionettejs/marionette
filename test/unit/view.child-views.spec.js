describe('layoutView', function() {
  'use strict';

  beforeEach(function() {
    this.layoutViewManagerTemplateFn = _.template('<div id="regionOne"></div><div id="regionTwo"></div>');
    this.template = function() {
      return '<span class=".craft"></span><h1 id="#a-fun-game"></h1>';
    };

    this.View = Backbone.Marionette.View.extend({
      template: this.layoutViewManagerTemplateFn,
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

    this.CustomRegion1 = function() {};

    this.CustomRegion2 = Backbone.Marionette.Region.extend();

    this.ViewNoDefaultRegion = this.View.extend({
      regions: {
        regionOne: {
          selector: '#regionOne',
          regionClass: this.CustomRegion1
        },
        regionTwo: '#regionTwo'
      }
    });
  });

  describe('on instantiation', function() {
    beforeEach(function() {
      let suite = this;
      this.ViewInitialize = this.View.extend({
        initialize: function() {
          suite.regionOne = this.getRegion('regionOne');
        }
      });

      this.layoutViewManager = new this.ViewInitialize();
    });

    it('should instantiate the specified region before initialize', function() {
      expect(this.regionOne).to.equal(this.layoutViewManager.getRegion('regionOne'));
    });

    it('should create backlink with region manager', function() {
      it('should instantiate the specified region managers', function() {
        expect(this.layoutViewManager._parent).to.deep.equal(this.layoutViewManager);
      });
    });
  });

  describe('on instantiation with no regions defined', function() {
    beforeEach(function() {
      let suite = this;
      this.NoRegions = Marionette.View.extend({});
      this.init = function() {
        suite.layoutViewManager = new suite.NoRegions();
      };
    });

    it('should instantiate the specified region managers', function() {
      expect(this.init).not.to.throw;
    });
  });

  describe('on instantiation with custom region managers', function() {
    beforeEach(function() {
      this.ViewCustomRegion = this.View.extend({
        regionClass: this.CustomRegion1,
        regions: {
          regionOne: {
            el: '#regionOne',
            regionClass: this.CustomRegion1
          },
          regionTwo: {
            el: '#regionTwo',
            regionClass: this.CustomRegion2,
            specialOption: true
          },
          regionThree: {
            el: '#regionThree'
          },
          regionFour: '#regionFour'
        }
      });

      this.layoutViewManager = new this.ViewCustomRegion();
    });

    it('should instantiate specific regions with custom regions if specified', function() {
      expect(this.layoutViewManager.getRegion('regionOne')).to.be.instanceof(this.CustomRegion1);
      expect(this.layoutViewManager.getRegion('regionTwo')).to.be.instanceof(this.CustomRegion2);
    });

    it('should instantiate the default regionManager if specified', function() {
      expect(this.layoutViewManager.getRegion('regionThree')).to.be.instanceof(this.CustomRegion1);
      expect(this.layoutViewManager.getRegion('regionThree')).to.be.instanceof(this.CustomRegion1);
    });

    it('should instantiate marionette regions is no regionClass is specified', function() {
      let layoutViewManagerNoDefault = new this.ViewNoDefaultRegion();
      expect(layoutViewManagerNoDefault.getRegion('regionTwo')).to.be.instanceof(Backbone.Marionette.Region);
    });

    it('should pass extra options to the custom regionClass', function() {
      expect(this.layoutViewManager.getRegion('regionTwo')).to.have.property('options');
      expect(this.layoutViewManager.getRegion('regionTwo').options).to.have.property('specialOption');
      expect(this.layoutViewManager.getRegion('regionTwo').options.specialOption).to.be.ok;
    });
  });

  describe('when regions are defined as a function', function() {
    beforeEach(function() {
      const View = this.View.extend({
        regions: function() {
          return {
            regionOne: '#regionOne',
            regionTwo: '#regionTwo'
          };
        }
      });

      this.layoutView = new View();
      this.layoutView.render();
    });

    it('should build the regions from the returns object literal', function() {
      expect(this.layoutView.getRegion('regionOne')).to.be.instanceof(Backbone.Marionette.Region);
    });
  });

  describe('on rendering', function() {
    beforeEach(function() {
      this.layoutViewManager = new this.View();
      sinon.spy(this.layoutViewManager, 'onRender');
      sinon.spy(this.layoutViewManager, 'onBeforeRender');
      sinon.spy(this.layoutViewManager, 'trigger');
      this.layoutViewManager.render();
    });

    it('should find the region scoped within the rendered template', function() {
      this.layoutViewManager.getRegion('regionOne')._ensureElement();
      let el = this.layoutViewManager.$('#regionOne');
      expect(this.layoutViewManager.getRegion('regionOne').$el[0]).to.equal(el[0]);
    });

    it('should call "onBeforeRender" before rendering', function() {
      expect(this.layoutViewManager.onBeforeRender).to.have.been.calledOnce;
    });

    it('should call "onRender" after rendering', function() {
      expect(this.layoutViewManager.onRender).to.have.been.calledOnce;
    });

    it('should call "onBeforeRender" before "onRender"', function() {
      expect(this.layoutViewManager.onBeforeRender).to.have.been.calledBefore(this.layoutViewManager.onRender);
    });

    it('should not be rendered when "onBeforeRender" is called', function() {
      expect(this.layoutViewManager.onBeforeRender.lastCall.returnValue).not.to.be.ok;
    });

    it('should be rendered when "onRender" is called', function() {
      expect(this.layoutViewManager.onRender.lastCall.returnValue).to.be.true;
    });

    it('should trigger a "before:render" event', function() {
      expect(this.layoutViewManager.trigger).to.have.been.calledWith('before:render', this.layoutViewManager);
    });

    it('should trigger a "render" event', function() {
      expect(this.layoutViewManager.trigger).to.have.been.calledWith('render', this.layoutViewManager);
    });

    it('should be marked rendered', function() {
      expect(this.layoutViewManager).to.have.property('_isRendered', true);
    });
  });

  describe('when destroying', function() {

    beforeEach(function() {
      this.layoutViewManager = new this.View();
      $('<span id="parent">').append(this.layoutViewManager.el);
      this.layoutViewManager.render();

      this.regionOne = this.layoutViewManager.getRegion('regionOne');
      this.regionTwo = this.layoutViewManager.getRegion('regionTwo');

      const View = Marionette.View.extend({
        template: _.noop,
        destroy: function() {
          this.hadParent = this.$el.closest('#parent').length > 0;
          return View.__super__.destroy.call(this);
        }
      });

      this.regionOneView = new View();
      this.sinon.spy(this.regionOne, 'empty');
      this.sinon.spy(this.regionTwo, 'empty');

      this.regionOne.show(this.regionOneView);

      this.sinon.spy(this.layoutViewManager, 'destroy');
      this.layoutViewManager.destroy();
      this.layoutViewManager.destroy();
    });

    it('should empty the region managers', function() {
      expect(this.regionOne.empty).to.have.been.calledTwice;
      expect(this.regionTwo.empty).to.have.been.calledOnce;
    });

    it('should delete the region managers', function() {
      expect(this.layoutViewManager.getRegion('regionOne')).to.be.undefined;
      expect(this.layoutViewManager.getRegion('regionTwo')).to.be.undefined;
    });

    it('should return the view', function() {
      expect(this.layoutViewManager.destroy).to.have.always.returned(this.layoutViewManager);
    });

    it('should remove itself from the DOM before destroying child regions by default', function() {
      expect(this.regionOneView.hadParent).to.be.false;
    });

    it('should be marked destroyed', function() {
      expect(this.layoutViewManager).to.have.property('_isDestroyed', true);
    });

    it('should be marked not rendered', function() {
      expect(this.layoutViewManager).to.have.property('_isRendered', false);
    });
  });

  describe('when showing a childView as a basic Backbone.View', function() {
    beforeEach(function() {
      const BBView = Backbone.View.extend();
      _.extend(BBView.prototype, Marionette.Events);

      this.layoutView = new this.View();
      this.layoutView.render();

      // create a basic Backbone child view
      this.childView = new BBView();
      this.layoutView.showChildView('regionOne', this.childView);
    });

    it('shows the childview in the region', function() {
      expect(this.layoutView.getChildView('regionOne')).to.equal(this.childView);
    });
  });

  describe('when using showChildView with options', function() {
    let options = {myOption: 'some value'};

    beforeEach(function() {
      const BBView = Backbone.View.extend();
      _.extend(BBView.prototype, Marionette.Events);

      this.layoutView = new this.View().render();
      this.regionOne = this.layoutView.getRegion('regionOne');
      this.childView = new BBView();
      this.sinon.spy(this.regionOne, 'show');
      this.layoutView.showChildView('regionOne', this.childView, options);
    });

    it('passes the options hash to the region', function() {
      expect(this.regionOne.show)
        .to.have.been.calledOnce
        .and.calledWith(this.childView, options);
    });
  });

  describe('when showing a childView as a View', function() {
    beforeEach(function() {
      this.layoutView = new this.View();
      this.childEventsHandlerTrigger = this.sinon.spy();
      this.childEventsHandlerTriggerMethod = this.sinon.spy();

      // add child events to listen for
      this.layoutView.childViewEvents = {
        'before:content:rendered': this.childEventsHandlerTrigger,
        'content:rendered': this.childEventsHandlerTriggerMethod
      };
      this.layoutView.delegateEvents();
      this.layoutView.render();

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
      this.childView = new ChildView();

      this.layoutView.showChildView('regionOne', this.childView);
    });

    it('shows the childview in the region', function() {
      expect(this.layoutView.getChildView('regionOne')).to.equal(this.childView);
    });

    it('childViewEvents are triggered', function() {
      expect(this.childEventsHandlerTrigger).to.have.been.calledOnce;
    });

    it('childViewEvents are triggered', function() {
      expect(this.childEventsHandlerTriggerMethod).to.have.been.calledOnce;
    });

    describe('and the view is detached', function() {
      beforeEach(function() {
        this.detachedView = this.layoutView.detachChildView('regionOne');
        this.noDetachedView = this.layoutView.detachChildView('regionOne');
      });

      it('should return the childView it was given', function() {
        expect(this.detachedView).to.equal(this.childView);
      });

      it('should not return a childView if it was already detached', function() {
        expect(this.noDetachedView).to.be.undefined;
      });
    });
  });

  describe('when showing a layoutView via a region', function() {
    beforeEach(function() {
      let suite = this;

      this.setFixtures('<div id="mgr"></div>');

      this.layoutView = new this.View();
      this.layoutView.onRender = function() {
        suite.regionOne = suite.layoutView.getRegion('regionOne');
        suite.regionOne._ensureElement();
      };

      this.region = new Backbone.Marionette.Region({
        el: '#mgr'
      });

      this.showReturn = this.region.show(this.layoutView);
    });

    it('should make the regions available in `onRender`', function() {
      expect(this.regionOne).to.exist;
    });

    it('the regions should find their elements in `onRender`', function() {
      expect(this.regionOne.$el.length).to.equal(1);
    });

    it('should return the region after showing a view in a region', function() {
      expect(this.showReturn).to.equal(this.region);
    });
  });

  describe('when destroying a childView as a View', function() {
    beforeEach(function() {
      this.childEventsHandler = this.sinon.spy();
      this.layoutView = new this.View({
        childViewEvents: {
          'destroy': this.childEventsHandler
        }
      });

      this.layoutView.render();

      // create a child view which triggers an event on render
      let ChildView = Marionette.View.extend({
        template: _.noop
      });
      this.childView = new ChildView();

      this.layoutView.showChildView('regionOne', this.childView);
      this.childView.destroy();
    });

    it('childViewEvents "destroy" method is triggered', function() {
      expect(this.childEventsHandler).to.have.been.calledOnce;
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
    beforeEach(function() {
      const BBView = Backbone.View.extend();
      _.extend(BBView.prototype, Marionette.Events);

      this.ViewBoundRender = this.View.extend({
        initialize: function() {
          if (this.model) {
            this.listenTo(this.model, 'change', this.render);
          }
        }
      });

      this.layoutView = new this.ViewBoundRender({
        model: new Backbone.Model()
      });
      this.layoutView.render();

      this.sinon.spy(this.layoutView.getRegion('regionOne'), 'empty');
      this.view = new BBView();
      this.view.destroy = function() {};
      this.layoutView.getRegion('regionOne').show(this.view);

      this.layoutView.render();
      this.layoutView.getRegion('regionOne').show(this.view);
      this.region = this.layoutView.getRegion('regionOne');
    });

    it('should re-bind the regions to the newly rendered elements', function() {
      expect(this.region.$el.parent()[0]).to.equal(this.layoutView.el);
    });

    it('triggers "before:render" before emptying the regions', function() {
      let cb = function() {
        expect(this.region.$el).to.exist;
      };
      this.layoutView.listenTo(this.layoutView, 'before:render', cb.bind(this));
      this.layoutView.render();
    });

    it('should call empty twice', function() {
      expect(this.region.empty).to.have.been.calledThrice;
    });

    describe('and the views "render" function is bound to an event in the "initialize" function', function() {
      beforeEach(function() {
        let suite = this;
        this.layoutView.onRender = function() {
          this.getRegion('regionOne').show(suite.view);
        };

        this.layoutView.model.trigger('change');
      });

      it('should re-bind the regions correctly', function() {
        expect(this.layoutView.$('#regionOne')).not.to.equal();
      });
    });
  });

  describe('when getting a region', function() {
    beforeEach(function() {
      this.layoutView = new this.View();
      this.region = this.layoutView.getRegion('regionOne');
    });

    it('should return the region', function() {
      expect(this.layoutView.getRegion('regionOne')).to.equal(this.region);
    });
  });

  describe('when checking for a region', function() {
    beforeEach(function() {
      this.layoutView = new this.View();
      this.region = this.layoutView.getRegion('regionOne');
    });

    it('should return if has the region', function() {
      expect(this.layoutView.hasRegion('regionOne')).to.equal(true);
      expect(this.layoutView.hasRegion('regionNone')).to.equal(false);
    });
  });

  describe('when adding regions in a layoutViews options', function() {
    beforeEach(function() {
      let suite = this;

      this.CustomRegion = this.sinon.spy();
      this.regionOptions = {
        war: '.craft',
        is: {
          regionClass: this.CustomRegion,
          selector: '#a-fun-game'
        }
      };

      this.layoutView = new Backbone.Marionette.View({
        template: this.template,
        regions: this.regionOptions
      });

      this.layoutView2 = new Backbone.Marionette.View({
        template: this.template,
        regions: function() {
          return suite.regionOptions;
        }
      });
    });

    it('should lookup and set the regions', function() {
      expect(this.layoutView.getRegion('is')).to.exist;
      expect(this.layoutView.getRegion('war')).to.exist;
    });

    it('should lookup and set the regions when passed a function', function() {
      expect(this.layoutView2.getRegion('is')).to.exist;
      expect(this.layoutView2.getRegion('war')).to.exist;
    });

    it('should set custom region classes', function() {
      expect(this.CustomRegion).to.have.been.called;
    });
  });

  describe('when defining region selectors using @ui. syntax', function() {
    beforeEach(function() {
      let UIView = Backbone.Marionette.View.extend({
        template: this.template,
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
      this.layoutView = new UIView();
    });

    it('should apply the relevant @ui. syntax selector to a simple string value', function() {
      expect(this.layoutView.getRegion('war')).to.exist;
    });
    it('should apply the relevant @ui. syntax selector to selector in a region definition object', function() {
      expect(this.layoutView.getRegion('mario')).to.exist;
    });
    it('should apply the relevant @ui. syntax selector to el in a region definition object', function() {
      expect(this.layoutView.getRegion('princess')).to.exist;
    });
  });

  describe('when a layout has regions', function() {
    beforeEach(function() {
      this.layout = new this.View();
    });

    it('should be able to retrieve all regions', function() {
      this.layout.render();
      this.regions = this.layout.getRegions();
      expect(this.regions.regionOne).to.equal(this.layout.getRegion('regionOne'));
      expect(this.regions.regionTwo).to.equal(this.layout.getRegion('regionTwo'));
    });

    it('should render the view if it hasn\'t been yet', function() {
      this.sinon.spy(this.layout, 'render');
      this.layout.getRegions();
      expect(this.layout.render).to.be.calledOnce;
    });

    describe('when the regions are specified via regions hash and the view has no template', function() {
      beforeEach(function() {
        let fixture =
          '<div class="region-hash-no-template-spec">' +
            '<div class="region-one">Out-of-scope region</div>' +
            '<div class="some-layout-view">' +
              '<div class="region-one">In-scope region</div>' +
            '</div>' +
          '</div>';
        this.setFixtures(fixture);
        this.layout.render();
        this.regions = this.layout.getRegions();
        this.View = Backbone.Marionette.View.extend({
          el: '.region-hash-no-template-spec .some-layout-view',
          template: _.noop,
          regions: {
            regionOne: '.region-one'
          }
        });
        this.layoutViewInstance = new this.View();
        let $specNode = $('.region-hash-no-template-spec');
        this.$inScopeRegion = $specNode.find('.some-layout-view .region-one');
        this.$outOfScopeRegion = $specNode.children('.region-one');
      });

      it('after initialization, the view\'s regions should be scoped to its parent view', function() {
        expect(this.layoutViewInstance.getRegion('regionOne').$el).to.have.length(1);
        expect(this.layoutViewInstance.getRegion('regionOne').$el.is(this.$inScopeRegion)).to.equal(true);
        expect(this.layoutViewInstance.getRegion('regionOne').$el.is(this.$outOfScopeRegion)).to.equal(false);
      });
    });
  });

  describe('manipulating regions', function() {
    beforeEach(function() {
      this.beforeAddRegionSpy = this.sinon.spy();
      this.addRegionSpy = this.sinon.spy();
      this.beforeRegionRemoveSpy = this.sinon.spy();
      this.removeRegionSpy = this.sinon.spy();

      this.Layout = Marionette.View.extend({
        template: _.noop,
        onBeforeAddRegion: this.beforeAddRegionSpy,
        onAddRegion: this.addRegionSpy,
        onBeforeRemoveRegion: this.beforeRegionRemoveSpy,
        onRemoveRegion: this.removeRegionSpy
      });

      this.layout = new this.Layout();

      this.regionName = 'myRegion';
      this.layout.addRegion(this.regionName, '.region-selector');
    });

    it('should trigger correct region add events', function() {
      expect(this.beforeAddRegionSpy)
        .to.have.been.calledOnce
        .and.calledOn(this.layout)
        .and.calledWith(this.layout, this.regionName);

      expect(this.addRegionSpy)
        .to.have.been.calledOnce
        .and.calledOn(this.layout)
        .and.calledWith(this.layout, this.regionName);
    });

    it('should trigger correct region remove events', function() {
      this.layout.removeRegion(this.regionName);

      expect(this.beforeRegionRemoveSpy)
        .to.have.been.calledOnce
        .and.calledOn(this.layout)
        .and.calledWith(this.layout, this.regionName);

      expect(this.removeRegionSpy)
        .to.have.been.calledOnce
        .and.calledOn(this.layout)
        .and.calledWith(this.layout, this.regionName);
    });
  });

});
