import { vi, describe, it, expect, beforeEach } from 'vitest';
import '../setup/backbone.js';
import _ from 'underscore';
import Backbone from 'backbone';
import { View } from 'marionette';

describe('View.setRenderer', function() {
  let ViewClass;
  let ViewSubClass;
  let model;

  const template = 'fooTemplate';
  const data = { foo: 'bar' };

  beforeEach(function() {
    ViewClass = View.extend();
    ViewSubClass = ViewClass.extend();
    model = new Backbone.Model(data);
  });

  describe('when setting a renderer on a View class', function() {
    it('should return the View class', function() {
      expect(ViewClass.setRenderer()).to.be.eq(ViewClass);
    });
  });

  describe('when changing a renderer on a View class', function() {
    let rendererStub;

    beforeEach(function() {
      rendererStub = vi.fn();

      ViewClass.setRenderer(rendererStub);

      const view = new ViewClass({ template, model });

      view.render();
    });

    it('should use the custom renderer to render', function() {
      expect(rendererStub).toHaveBeenCalledTimes(1);
      expect(rendererStub.mock.calls.map(args => args.slice(0, 2))).toContainEqual([template, data]);
    });

    it('should not affect the renderer of the extended View', function() {
      rendererStub.mockClear();

      const baseView = new View({ template: _.template('bar'), model });
      baseView.render();

      expect(rendererStub).not.toHaveBeenCalled();
    });

    describe('when inheriting from the view class', function() {
      it('should use the custom renderer', function() {
        rendererStub.mockClear();

        const subView = new ViewSubClass({ template, model });
        subView.render();

        expect(rendererStub).toHaveBeenCalledTimes(1);
        expect(rendererStub.mock.calls.map(args => args.slice(0, 2))).toContainEqual([template, data]);
      });
    });

    describe('when changing a renderer on an inherited class', function() {
      let subRendererStub;

      beforeEach(function() {
        subRendererStub = vi.fn();

        ViewSubClass.setRenderer(subRendererStub);

        rendererStub.mockClear();

        const view = new ViewSubClass({ template, model });

        view.render();
      });

      it('should use the custom renderer to render', function() {
        expect(subRendererStub).toHaveBeenCalledTimes(1);
        expect(subRendererStub.mock.calls.map(args => args.slice(0, 2))).toContainEqual([template, data]);
      });

      it('should not use the custom renderer of the inherited class', function() {
        expect(rendererStub).not.toHaveBeenCalled();
      });
    });
  });

  it('should invoke the renderer with the View and attach its return value', function() {
    let rendererContext;
    const RendererView = View.extend({
      template: _.constant('ignored')
    });

    RendererView.setRenderer(function(viewTemplate, renderedData) {
      rendererContext = this;
      return `${ viewTemplate() }:${ renderedData.foo }`;
    });

    const view = new RendererView({ model });
    const attachElContentSpy = vi.spyOn(view, 'attachElContent');

    view.render();

    expect(rendererContext).to.equal(view);
    expect(view.el.textContent).to.equal(`ignored:${ data.foo }`);
    expect(attachElContentSpy).toHaveBeenCalledTimes(1);
  });
});
