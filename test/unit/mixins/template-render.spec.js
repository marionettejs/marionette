import _ from 'underscore';
import Backbone from 'backbone';

import TemplateRenderMixin from '../../../src/mixins/template-render';

describe('template-render', function() {
  let renderer;

  beforeEach(function() {
    renderer = _.extend({
      render() {
        // Simple mixin implementation
        this._renderTemplate(this.getTemplate());
      },
      Dom: {
        setContents: this.sinon.stub()
      }
    }, TemplateRenderMixin);
  });

  describe('when rendering (#_renderTemplate)', function() {
    const testData = { data: 'foo' };

    beforeEach(function() {
      renderer.template = this.sinon.stub();
      renderer.serializeData = this.sinon.stub().returns(testData);
      this.sinon.spy(renderer, 'mixinTemplateContext');
      this.sinon.spy(renderer, 'attachElContent');
    });

    it('should serialize data', function() {
      renderer.render();
      expect(renderer.serializeData).to.have.been.calledOnce;
    });

    it('should mixin template context', function() {
      renderer.render();
      expect(renderer.mixinTemplateContext)
        .to.have.been.calledOnce
        .and.calledWith(testData);
    });

    // Tests default renderer #_renderHtml
    it('should render data in a template', function() {
      renderer.render();
      expect(renderer.template)
        .to.have.been.calledOnce
        .and.calledWith(testData);
    });

    describe('when renderer returns html', function() {
      it('should attach content', function() {
        renderer._renderHtml = _.constant('html');
        renderer.render();
        expect(renderer.attachElContent)
          .to.have.been.calledOnce
          .and.calledWith('html');
      });
    });

    // An empty template should still render
    describe('when rendering returns an empty string', function() {
      it('should attach content', function() {
        renderer._renderHtml = _.constant('');
        renderer.render();
        expect(renderer.attachElContent)
          .to.have.been.calledOnce
          .and.calledWith('');
      });
    });

    describe('when renderer does not return html', function() {
      it('should attach content', function() {
        renderer._renderHtml = _.noop;
        renderer.render();
        expect(renderer.attachElContent).to.not.have.been.called;
      });
    });
  });

  describe('default #getTemplate', function() {
    it('should return this.template', function() {
      renderer.template = 'foo';
      expect(renderer.getTemplate()).to.equal('foo');
    });
  });

  describe('when mixing template context', function() {

    beforeEach(function() {
      renderer.template = _.noop;
      renderer._renderHtml = this.sinon.stub();
      renderer.serializeData = this.sinon.stub().returns({ foo: 'data', bar: 'data' });
    });

    describe('when templateContext is a method', function() {
      it('should mix the templateCotext results and data', function() {
        renderer.templateContext = this.sinon.stub().returns({ baz: 'tc' });
        renderer.render();
        expect(renderer._renderHtml)
          .to.be.calledOnce
          .and.calledWith(renderer.template, { foo: 'data', bar: 'data', baz: 'tc' });
      });
    });

    describe('when templateContext is not defined', function() {
      it('should return the data', function() {
        renderer.render();
        expect(renderer._renderHtml)
          .to.be.calledOnce
          .and.calledWith(renderer.template, { foo: 'data', bar: 'data' });
      });
    });

    describe('when no data is serialized', function() {
      it('should return the templateContext', function() {
        renderer.serializeData = this.sinon.stub();
        renderer.templateContext = this.sinon.stub().returns({ baz: 'tc' });
        renderer.render();
        expect(renderer._renderHtml)
          .to.be.calledOnce
          .and.calledWith(renderer.template, { baz: 'tc' });
      });
    });

    describe('when template context and data is defined', function() {
      it('should mix the context with data giving context priority', function() {
        renderer.templateContext = { bar: 'tc', baz: 'tc' };
        renderer.render();
        expect(renderer._renderHtml)
          .to.be.calledOnce
          .and.calledWith(renderer.template, { foo: 'data', bar: 'tc', baz: 'tc' });
      });
    });
  });

  describe('when serializing data', function() {
    let model;
    let collection;

    beforeEach(function() {
      model = new Backbone.Model({ foo: 'data' });
      collection = new Backbone.Collection([{ id: 1 }, { id: 2 }]);
      renderer.template = _.noop;
      this.sinon.spy(renderer, 'serializeModel');
      this.sinon.spy(renderer, 'serializeCollection');
      this.sinon.spy(renderer, '_renderHtml');
    });


    describe('when object has no model or collection', function() {
      beforeEach(function() {
        renderer.render();
      });

      it('should not serialize the model', function() {
        expect(renderer.serializeModel).to.not.be.called;
      });

      it('should not serialize the collection', function() {
        expect(renderer.serializeCollection).to.not.be.called;
      });

      it('should send an empty object to the renderer', function() {
        expect(renderer._renderHtml)
          .to.be.calledOnce
          .and.calledWith(renderer.template, {});
      });
    });

    describe('when object has a model', function() {
      beforeEach(function() {
        renderer.model = model;
        renderer.render();
      });

      it('should serialize the model', function() {
        expect(renderer.serializeModel).to.be.calledOnce;
      });

      it('should not serialize the collection', function() {
        expect(renderer.serializeCollection).to.not.be.called;
      });

      it('should send the model attributes to the renderer', function() {
        expect(renderer._renderHtml)
          .to.be.calledOnce
          .and.calledWith(renderer.template, { foo: 'data' });
      });
    });

    describe('when object has only a collection', function() {
      beforeEach(function() {
        renderer.collection = collection;
        renderer.render();
      });

      it('should not serialize the model', function() {
        expect(renderer.serializeModel).to.not.be.called;
      });

      it('should serialize the collection', function() {
        expect(renderer.serializeCollection).to.be.calledOnce;
      });

      it('should send the collection data on items to the renderer', function() {
        expect(renderer._renderHtml)
          .to.be.calledOnce
          .and.calledWith(renderer.template, { items: [{ id: 1 },{ id: 2 }] });
      });
    });

    describe('when object has both model and collection', function() {
      beforeEach(function() {
        renderer.model = model;
        renderer.collection = collection;
        renderer.render();
      });

      it('should serialize the model', function() {
        expect(renderer.serializeModel).to.be.calledOnce;
      });

      it('should not serialize the collection', function() {
        expect(renderer.serializeCollection).to.not.be.called;
      });
    });
  });

  describe('when attaching content', function() {
    it('should call the DOM Mixin', function() {
      renderer.el = 'fooEl';
      renderer.$el = '$fooEl';
      renderer._renderHtml = _.constant('html');
      renderer.render();

      // 3rd argument is for internal use only
      expect(renderer.Dom.setContents)
        .to.have.been.calledOnce
        .and.calledWith('fooEl', 'html', '$fooEl');
    });
  })
});
