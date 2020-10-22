import Backbone from 'backbone';
import Region from '../../src/region';
import View from '../../src/view';

describe('item view', function() {
  'use strict';

  let modelData;
  let model;
  let template;
  let templateStub;

  beforeEach(function() {
    modelData = {foo: 'bar'};
    model = new Backbone.Model(modelData);

    template = 'foobar';
    templateStub = this.sinon.stub().returns(template);
  });

  // Fixes https://github.com/marionettejs/backbone.marionette/issues/3527
  describe('when entity events are added in initialize', function() {
    it('should not undelegate them', function() {
      const TestView = Marionette.View.extend({
        template: false,
        initialize() {
          this.listenTo(model, 'foo', this.onFoo);
        },
        onFoo: this.sinon.stub()
      });

      const view = new TestView({ model });

      model.trigger('foo');

      expect(view.onFoo).to.have.been.calledOnce;
    });
  });

  describe('when instantiating a view with a DOM element', function() {
    let view;

    beforeEach(function() {
      this.setFixtures('<div id="foo"><span class="element">bar</span></div>');
      view = new View({
        el: '#foo',
        ui: {
          element: '.element'
        }
      });
    });

    it('should be rendered', function() {
      expect(view.isRendered()).to.be.true;
    });

    it('should be attached', function() {
      expect(view.isAttached()).to.be.true;
    });

    it('should contain the DOM content', function() {
      expect(view.el.innerHTML).to.contain('<span class="element">bar</span>');
    });

    it('should bind ui elements', function() {
      expect(view.ui.element.text()).to.contain('bar');
    });
  });

  describe('when instantiating a view with a non existing DOM element', function() {
    let view;

    beforeEach(function() {
      this.setFixtures('<div id="foo"><span class="element">bar</span></div>');
      view = new View({
        el: '#nonexistent'
      });
    });

    it('should not be rendered', function() {
      expect(view.isRendered()).to.be.false;
    });

    it('should not be attached', function() {
      expect(view.isAttached()).to.be.false;
    });
  });

  describe('when rendering without a valid template', function() {
    let view;

    beforeEach(function() {
      view = new View();
    });

    it('should throw an exception because there was no valid template', function() {
      expect(function() {view.render()}).to.throw();
    });
  });

  describe('when rendering with a false template', function() {
    let onBeforeRenderStub;
    let onRenderStub;
    let TestView;
    let marionetteRendererSpy;
    let serializeDataSpy;
    let mixinTemplateContextSpy;
    let attachElContentSpy;
    let bindUIElementsSpy;
    let view;

    beforeEach(function() {
      onBeforeRenderStub = this.sinon.stub();
      onRenderStub = this.sinon.stub();

      TestView = View.extend({
        template: false,
        onBeforeRender: onBeforeRenderStub,
        onRender: onRenderStub,

        ui: {
          testElement: '.test-element'
        }
      });

      view = new TestView();

      marionetteRendererSpy = this.sinon.spy(view, '_renderHtml');
      serializeDataSpy = this.sinon.spy(view, 'serializeData');
      mixinTemplateContextSpy = this.sinon.spy(view, 'mixinTemplateContext');
      attachElContentSpy = this.sinon.spy(view, 'attachElContent');
      bindUIElementsSpy = this.sinon.spy(view, 'bindUIElements');

      view.render();
    });

    it('should not throw an exception for a false template', function() {
      expect(view.render.bind(view)).to.not.throw();
    });

    it('should not call an "onBeforeRender" method on the view', function() {
      expect(onBeforeRenderStub).to.not.have.been.called;
    });

    it('should not call an "onRender" method on the view', function() {
      expect(onRenderStub).to.not.have.been.called;
    });

    it('should not call bindUIElements', function() {
      expect(bindUIElementsSpy).to.not.have.been.called;
    });

    it('should not add in data or template context', function() {
      expect(serializeDataSpy).to.not.have.been.called;
      expect(mixinTemplateContextSpy).to.not.have.been.called;
    });

    it('should not render a template', function() {
      expect(marionetteRendererSpy).to.not.have.been.called;
    });

    it('should not attach any html content', function() {
      expect(attachElContentSpy).to.not.have.been.called;
    });

    it('should not claim isRendered', function() {
      expect(view.isRendered()).to.be.false;
    });

    describe('and there is prerendered content', function() {
      let elView;

      beforeEach(function() {
        this.setFixtures('<div id="foo">bar</div>');
        elView = new TestView({ el: '#foo' });
      });

      it('should stay rendered', function() {
        expect(elView.isRendered()).to.be.true;
      });
    });
  });


  describe('when destroying an item view', function() {
    let onBeforeDestroyStub;
    let onDestroyStub;
    let TestView;
    let view;
    let removeSpy;
    let stopListeningSpy;
    let triggerSpy;

    beforeEach(function() {
      onBeforeDestroyStub = this.sinon.spy(function() {
        return {
          isRendered: this.isRendered(),
          isDestroyed: this.isDestroyed()
        };
      });
      onDestroyStub = this.sinon.spy(function() {
        return {
          isRendered: this.isRendered(),
          isDestroyed: this.isDestroyed()
        };
      });

      TestView = View.extend({
        template: templateStub,
        onBeforeDestroy: onBeforeDestroyStub,
        onDestroy: onDestroyStub
      });

      view = new TestView();
      view.render();

      removeSpy = this.sinon.spy(view, '_removeElement');
      stopListeningSpy = this.sinon.spy(view, 'stopListening');
      triggerSpy = this.sinon.spy(view, 'trigger');

      this.sinon.spy(view, 'destroy');
      view.destroy();
    });

    it('should remove the views EL from the DOM', function() {
      expect(removeSpy).to.have.been.calledOnce;
    });

    it('should unbind any listener to custom view events', function() {
      expect(stopListeningSpy).to.have.been.calledOnce;
    });

    it('should trigger "before:destroy"', function() {
      expect(triggerSpy).to.have.been.calledWith('before:destroy');
    });

    it('should trigger "destroy"', function() {
      expect(triggerSpy).to.have.been.calledWith('destroy');
    });

    it('should call "onBeforeDestroy" if provided', function() {
      expect(onBeforeDestroyStub).to.have.been.called;
    });

    it('should call "onDestroy" if provided', function() {
      expect(onDestroyStub).to.have.been.called;
    });

    it('should return the view', function() {
      expect(view.destroy).to.have.returned(view);
    });

    it('should not be destroyed when "onBeforeDestroy" is called', function() {
      expect(onBeforeDestroyStub.lastCall.returnValue.isDestroyed).not.to.be.ok;
    });

    it('should be rendered when "onBeforeDestroy" is called', function() {
      expect(onBeforeDestroyStub.lastCall.returnValue.isRendered).to.be.true;
    });

    it('should be destroyed when "onDestroy" is called', function() {
      expect(onDestroyStub.lastCall.returnValue.isDestroyed).to.be.true;
    });

    it('should not be rendered when "onDestroy" is called', function() {
      expect(onDestroyStub.lastCall.returnValue.isRendered).to.be.false;
    });

    it('should be marked destroyed', function() {
      expect(view).to.have.property('_isDestroyed', true);
    });

    it('should be marked not rendered', function() {
      expect(view).to.have.property('_isRendered', false);
    });
  });

  describe('when re-rendering an View that is already shown', function() {
    let onDomRefreshStub;
    let TestView;
    let view;
    let region;
    let TestRegion;

    beforeEach(function() {
      onDomRefreshStub = this.sinon.stub();

      TestView = View.extend({
        template: templateStub,
        onDomRefresh: onDomRefreshStub
      });

      this.setFixtures('<div id="region"></div>');
      TestRegion = Region.extend({
        el: '#region'
      });

      view = new TestView();
      region = new TestRegion();
      region.show(view);
      view.render();
    });

    it('should trigger a dom:refresh event', function() {
      expect(onDomRefreshStub).to.have.been.calledTwice;
    });
  });

  describe('has a valid inheritance chain back to Backbone.View', function() {
    let constructor;

    beforeEach(function() {
      constructor = this.sinon.spy(Backbone.View.prototype, 'constructor');
    });

    it('calls the parent Backbone.Views constructor function on instantiation with the proper parameters', function() {
      const options = {foo: 'bar'};
      const customParam = {foo: 'baz'};

      new View(options, customParam);
      expect(constructor).to.have.been.calledWith(options, customParam);
    });
  });

  describe('when instantiating a View', function() {
    it('should trigger `initialize` on the behaviors', function() {
      this.sinon.stub(View.prototype, '_triggerEventOnBehaviors');

      const myView = new View({ foo: 'bar' });

      // _triggerEventOnBehaviors comes from Behaviors mixin
      expect(myView._triggerEventOnBehaviors)
        .to.be.calledOnce.and.calledWith('initialize', myView, { foo: 'bar' });
    });
  });


});
