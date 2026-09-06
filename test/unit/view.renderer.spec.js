import _ from 'underscore';
import Backbone from 'backbone';
import View from '../../src/modules/view';

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

  it('should pass the renderer result through the DOM API with the View host', function() {
    let rendererContext;
    const RendererView = View.extend({
      template: _.constant('ignored')
    });

    RendererView.setRenderer(function(viewTemplate, renderedData) {
      rendererContext = this;
      return `${ viewTemplate() }:${ renderedData.foo }`;
    });

    const view = new RendererView({ model });
    const attachElContentSpy = this.sinon.spy(view, 'attachElContent');
    const setContentsSpy = this.sinon.spy(view.Dom, 'setContents');

    view.render();

    expect(rendererContext).to.equal(view);
    expect(view.el.textContent).to.equal(`ignored:${ data.foo }`);
    expect(attachElContentSpy).to.have.been.calledOnce;
    expect(setContentsSpy).to.have.been.calledWith(view.el, 'ignored:bar', view);
  });
  it('should forward undefined content to the DOM adapter instead of skipping it', function() {
    const setContents = this.sinon.spy();
    ViewClass.setDomApi({ setContents });
    ViewClass.setRenderer(() => undefined);
    const view = new ViewClass({ template: 'unused' });
    view.render();
    expect(setContents).to.have.been.calledOnce.and.calledWith(view.el, undefined, view);
  });

  it('should clear native contents when the template returns undefined', function() {
    const view = new View({ template: () => '<p>previous</p>' });
    view.render();
    view.template = () => undefined;
    view.render();
    expect(view.el.childNodes.length).to.equal(0);
  });

});
