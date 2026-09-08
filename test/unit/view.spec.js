import { vi, describe, it, expect, beforeEach } from 'vitest';
import { setFixtures } from '../setup/fixtures.js';
import * as Marionette from '../../src/index.ts';
import '../setup/backbone.js';
import Backbone from 'backbone';
import Region from '../../src/modules/region';
import View from '../../src/modules/view';

describe('view', function() {
  'use strict';

  let modelData;
  let model;
  let template;
  let templateStub;

  beforeEach(function() {
    modelData = {foo: 'bar'};
    model = new Backbone.Model(modelData);

    template = 'foobar';
    templateStub = vi.fn().mockReturnValue(template);
  });

  // Fixes https://github.com/marionettejs/backbone.marionette/issues/3527
  describe('when entity events are added in initialize', function() {
    it('should not undelegate them', function() {
      const TestView = Marionette.View.extend({
        template: false,
        initialize() {
          this.listenTo(model, 'foo', this.onFoo);
        },
        onFoo: vi.fn()
      });

      const view = new TestView({ model });

      model.trigger('foo');

      expect(view.onFoo).toHaveBeenCalledTimes(1);
    });
  });

  describe('when modelEvents contains an own __proto__ event', function() {
    it('throws before delegating to a Backbone model', function() {
      const modelOn = vi.spyOn(model, 'on');
      const modelEvents = {};
      Object.defineProperty(modelEvents, '__proto__', {
        enumerable: true,
        value: vi.fn()
      });
      const TestView = View.extend({
        template: false,
        modelEvents
      });

      expect(() => new TestView({ model }))
        .to.throw('Entity event maps cannot include an own "__proto__" event name.')
        .with.property('code', 'MN0026');
      expect(modelOn).not.toHaveBeenCalled();
    });
  });

  describe('when instantiating a view with a DOM element', function() {
    let view;

    beforeEach(function() {
      setFixtures('<div id="foo"><span class="element">bar</span></div>');
      view = new View({
        el: document.getElementById('foo'),
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
      expect(view.ui.element[0].textContent).to.contain('bar');
    });
  });

  describe('when instantiating a view with a non existing DOM element', function() {
    let view;

    beforeEach(function() {
      setFixtures('<div id="foo"><span class="element">bar</span></div>');
      view = new View({
        el: document.querySelector('#nonexistent')
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
      onBeforeRenderStub = vi.fn();
      onRenderStub = vi.fn();

      TestView = View.extend({
        template: false,
        onBeforeRender: onBeforeRenderStub,
        onRender: onRenderStub,

        ui: {
          testElement: '.test-element'
        }
      });

      view = new TestView();

      marionetteRendererSpy = vi.spyOn(view, '_renderHtml');
      serializeDataSpy = vi.spyOn(view, 'serializeData');
      mixinTemplateContextSpy = vi.spyOn(view, 'mixinTemplateContext');
      attachElContentSpy = vi.spyOn(view, 'attachElContent');
      bindUIElementsSpy = vi.spyOn(view, 'bindUIElements');

      view.render();
    });

    it('should not throw an exception for a false template', function() {
      expect(view.render.bind(view)).to.not.throw();
    });

    it('should not call an "onBeforeRender" method on the view', function() {
      expect(onBeforeRenderStub).not.toHaveBeenCalled();
    });

    it('should not call an "onRender" method on the view', function() {
      expect(onRenderStub).not.toHaveBeenCalled();
    });

    it('should not call bindUIElements', function() {
      expect(bindUIElementsSpy).not.toHaveBeenCalled();
    });

    it('should not add in data or template context', function() {
      expect(serializeDataSpy).not.toHaveBeenCalled();
      expect(mixinTemplateContextSpy).not.toHaveBeenCalled();
    });

    it('should not render a template', function() {
      expect(marionetteRendererSpy).not.toHaveBeenCalled();
    });

    it('should not attach any html content', function() {
      expect(attachElContentSpy).not.toHaveBeenCalled();
    });

    it('should not claim isRendered', function() {
      expect(view.isRendered()).to.be.false;
    });

    describe('and there is prerendered content', function() {
      let elView;

      beforeEach(function() {
        setFixtures('<div id="foo">bar</div>');
        elView = new TestView({ el: document.getElementById('foo') });
      });

      it('should stay rendered', function() {
        expect(elView.isRendered()).to.be.true;
      });
    });
  });


  describe('when destroying a view', function() {
    let onBeforeDestroyStub;
    let onDestroyStub;
    let TestView;
    let view;
    let removeSpy;
    let stopListeningSpy;
    let triggerSpy;

    beforeEach(function() {
      onBeforeDestroyStub = vi.fn(function() {
        return {
          isRendered: this.isRendered(),
          isDestroyed: this.isDestroyed()
        };
      });
      onDestroyStub = vi.fn(function() {
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

      removeSpy = vi.spyOn(view.Dom, 'detachEl');
      stopListeningSpy = vi.spyOn(view, 'stopListening');
      triggerSpy = vi.spyOn(view, 'trigger');

      vi.spyOn(view, 'destroy');
      view.destroy();
    });

    it('should remove the views EL from the DOM', function() {
      expect(removeSpy).toHaveBeenCalledTimes(1);
    });

    it('should unbind any listener to custom view events', function() {
      expect(stopListeningSpy).toHaveBeenCalledTimes(1);
    });

    it('should trigger "before:destroy"', function() {
      expect(triggerSpy.mock.calls.map(args => args.slice(0, 1))).toContainEqual(['before:destroy']);
    });

    it('should trigger "destroy"', function() {
      expect(triggerSpy.mock.calls.map(args => args.slice(0, 1))).toContainEqual(['destroy']);
    });

    it('should call "onBeforeDestroy" if provided', function() {
      expect(onBeforeDestroyStub).toHaveBeenCalled();
    });

    it('should call "onDestroy" if provided', function() {
      expect(onDestroyStub).toHaveBeenCalled();
    });

    it('should return the view', function() {
      expect(view.destroy).toHaveReturnedWith(view);
    });

    it('should not be destroyed when "onBeforeDestroy" is called', function() {
      expect(onBeforeDestroyStub.mock.results.at(-1).value.isDestroyed).not.to.be.ok;
    });

    it('should be rendered when "onBeforeDestroy" is called', function() {
      expect(onBeforeDestroyStub.mock.results.at(-1).value.isRendered).to.be.true;
    });

    it('should be destroyed when "onDestroy" is called', function() {
      expect(onDestroyStub.mock.results.at(-1).value.isDestroyed).to.be.true;
    });

    it('should not be rendered when "onDestroy" is called', function() {
      expect(onDestroyStub.mock.results.at(-1).value.isRendered).to.be.false;
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
      onDomRefreshStub = vi.fn();

      TestView = View.extend({
        template: templateStub,
        onDomRefresh: onDomRefreshStub
      });

      setFixtures('<div id="region"></div>');
      TestRegion = Region.extend({
        el: '#region'
      });

      view = new TestView();
      region = new TestRegion();
      region.show(view);
      view.render();
    });

    it('should trigger a dom:refresh event', function() {
      expect(onDomRefreshStub).toHaveBeenCalledTimes(2);
    });
  });

  describe('when instantiating a View', function() {
    it('should trigger `initialize` on the behaviors', function() {
      vi.spyOn(View.prototype, '_triggerEventOnBehaviors').mockImplementation(() => undefined);

      const myView = new View({ foo: 'bar' });

      // _triggerEventOnBehaviors comes from Behaviors mixin
      expect(myView._triggerEventOnBehaviors).toHaveBeenCalledTimes(1);
      expect(myView._triggerEventOnBehaviors.mock.calls.map(args => args.slice(0, 3))).toContainEqual(['initialize', myView, { foo: 'bar' }]);
    });
  });


});
