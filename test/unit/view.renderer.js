import _ from 'underscore';
import Backbone from 'backbone';
import View from '../../src/view';

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
      rendererStub = this.sinon.stub();

      ViewClass.setRenderer(rendererStub);

      const view = new ViewClass({ template, model });

      view.render();
    });

    it('should use the custom renderer to render', function() {
      expect(rendererStub).to.have.been.calledOnce.and.calledWith(template, data);
    });

    it('should not affect the renderer of the extended View', function() {
      rendererStub.reset();

      const baseView = new View({ template: _.template('bar'), model });
      baseView.render();

      expect(rendererStub).to.not.have.been.called;
    });

    describe('when inheriting from the view class', function() {
      it('should use the custom renderer', function() {
        rendererStub.reset();

        const subView = new ViewSubClass({ template, model });
        subView.render();

        expect(rendererStub).to.have.been.calledOnce.and.calledWith(template, data);
      });
    });

    describe('when changing a renderer on an inherited class', function() {
      let subRendererStub;

      beforeEach(function() {
        subRendererStub = this.sinon.stub();

        ViewSubClass.setRenderer(subRendererStub);

        rendererStub.reset();

        const view = new ViewSubClass({ template, model });

        view.render();
      });

      it('should use the custom renderer to render', function() {
        expect(subRendererStub).to.have.been.calledOnce.and.calledWith(template, data);
      });

      it('should not use the custom renderer of the inherited class', function() {
        expect(rendererStub).to.not.have.been.called;
      });
    });
  });
});
