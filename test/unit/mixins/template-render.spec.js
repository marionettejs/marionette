import { vi, describe, it, expect, beforeEach } from 'vitest';
import '../../setup/backbone.js';
import _ from 'underscore';
import Backbone from 'backbone';

import TemplateRenderMixin from '../../../src/mixins/template-render';
import BackboneApi from '../../../packages/adapters/src/data/backbone.ts';

describe('template-render', function() {
  let renderer;

  beforeEach(function() {
    renderer = _.extend({
      render() {
        // Simple mixin implementation
        this._renderTemplate(this.getTemplate());
      },
      Dom: {
        setContents: vi.fn()
      },
      Data: BackboneApi
    }, TemplateRenderMixin);
  });

  describe('when rendering (#_renderTemplate)', function() {
    const testData = { data: 'foo' };

    beforeEach(function() {
      renderer.template = vi.fn();
      renderer.serializeData = vi.fn().mockReturnValue(testData);
      vi.spyOn(renderer, 'mixinTemplateContext');
      vi.spyOn(renderer, 'attachElContent');
    });

    it('should serialize data', function() {
      renderer.render();
      expect(renderer.serializeData).toHaveBeenCalledTimes(1);
    });

    it('should mixin template context', function() {
      renderer.render();
      expect(renderer.mixinTemplateContext).toHaveBeenCalledTimes(1);
      expect(renderer.mixinTemplateContext.mock.calls.map(args => args.slice(0, 1))).toContainEqual([testData]);
    });

    // Tests default renderer #_renderHtml
    it('should render data in a template', function() {
      renderer.render();
      expect(renderer.template).toHaveBeenCalledTimes(1);
      expect(renderer.template.mock.calls.map(args => args.slice(0, 1))).toContainEqual([testData]);
    });

    describe('when renderer returns html', function() {
      it('should attach content', function() {
        renderer._renderHtml = _.constant('html');
        renderer.render();
        expect(renderer.attachElContent).toHaveBeenCalledTimes(1);
        expect(renderer.attachElContent.mock.calls.map(args => args.slice(0, 1))).toContainEqual(['html']);
      });
    });

    // An empty template should still render
    describe('when rendering returns an empty string', function() {
      it('should attach content', function() {
        renderer._renderHtml = _.constant('');
        renderer.render();
        expect(renderer.attachElContent).toHaveBeenCalledTimes(1);
        expect(renderer.attachElContent.mock.calls.map(args => args.slice(0, 1))).toContainEqual(['']);
      });
    });

    describe('when renderer does not return html', function() {
      it('should attach content', function() {
        renderer._renderHtml = _.noop;
        renderer.render();
        expect(renderer.attachElContent).toHaveBeenCalledTimes(1);
        expect(renderer.attachElContent.mock.calls.map(args => args.slice(0, 1))).toContainEqual([undefined]);
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
      renderer._renderHtml = vi.fn();
      renderer.serializeData = vi.fn().mockReturnValue({ foo: 'data', bar: 'data' });
    });

    describe('when templateContext is a method', function() {
      it('should mix the templateCotext results and data', function() {
        renderer.templateContext = vi.fn().mockReturnValue({ baz: 'tc' });
        renderer.render();
        expect(renderer.templateContext).toHaveBeenCalledTimes(1);
        expect(renderer.templateContext.mock.contexts).toContain(renderer);
        expect(renderer.templateContext).toHaveBeenCalledWith();
        expect(renderer._renderHtml).toHaveBeenCalledTimes(1);
        expect(renderer._renderHtml.mock.calls.map(args => args.slice(0, 2))).toContainEqual([renderer.template, { foo: 'data', bar: 'data', baz: 'tc' }]);
      });
    });

    it('reads templateContext once and propagates lookup errors', function() {
      const error = new Error('templateContext failed');
      const getter = vi.fn().mockImplementation(() => { throw error; });
      Object.defineProperty(renderer, 'templateContext', { get: getter });

      expect(() => renderer.mixinTemplateContext({ foo: 'data' })).to.throw(error);
      expect(getter).toHaveBeenCalledTimes(1);
    });

    describe('when templateContext is not defined', function() {
      it('should return the data', function() {
        renderer.render();
        expect(renderer._renderHtml).toHaveBeenCalledTimes(1);
        expect(renderer._renderHtml.mock.calls.map(args => args.slice(0, 2))).toContainEqual([renderer.template, { foo: 'data', bar: 'data' }]);
      });
    });

    describe('when no data is serialized', function() {
      it('should return the templateContext', function() {
        renderer.serializeData = vi.fn();
        renderer.templateContext = vi.fn().mockReturnValue({ baz: 'tc' });
        renderer.render();
        expect(renderer._renderHtml).toHaveBeenCalledTimes(1);
        expect(renderer._renderHtml.mock.calls.map(args => args.slice(0, 2))).toContainEqual([renderer.template, { baz: 'tc' }]);
      });
    });

    describe('when template context and data is defined', function() {
      it('should mix the context with data giving context priority', function() {
        renderer.templateContext = { bar: 'tc', baz: 'tc' };
        renderer.render();
        expect(renderer._renderHtml).toHaveBeenCalledTimes(1);
        expect(renderer._renderHtml.mock.calls.map(args => args.slice(0, 2))).toContainEqual([renderer.template, { foo: 'data', bar: 'tc', baz: 'tc' }]);
      });
    });

    it('merges only own template data and context keys', function() {
      const protoValue = { polluted: true };
      const data = Object.assign(Object.create({ inheritedData: true }), { ownData: true });
      const context = Object.assign(
        Object.create({ inheritedContext: true }),
        { ownContext: true }
      );
      Object.defineProperty(context, '__proto__', { enumerable: true, value: protoValue });
      renderer.serializeData.mockReturnValue(data);
      renderer.templateContext = context;

      renderer.render();

      const renderedData = renderer._renderHtml.mock.calls.at(0)[1];
      expect(renderedData).to.include({ ownData: true, ownContext: true });
      expect(renderedData).to.not.have.property('inheritedData');
      expect(renderedData).to.not.have.property('inheritedContext');
      expect(Object.getPrototypeOf(renderedData)).to.equal(Object.prototype);
      expect(Object.hasOwn(renderedData, '__proto__')).to.be.true;
      expect(Object.getOwnPropertyDescriptor(renderedData, '__proto__').value)
        .to.equal(protoValue);
    });

    it('preserves the original object when only data or context exists', function() {
      const data = Object.create({ inheritedData: true });
      const context = Object.create({ inheritedContext: true });

      delete renderer.templateContext;
      expect(renderer.mixinTemplateContext(data)).to.equal(data);

      renderer.templateContext = context;
      expect(renderer.mixinTemplateContext()).to.equal(context);
    });
  });

  describe('when serializing data', function() {
    let model;
    let collection;

    beforeEach(function() {
      model = new Backbone.Model({ foo: 'data' });
      collection = new Backbone.Collection([{ id: 1 }, { id: 2 }]);
      renderer.template = _.noop;
      vi.spyOn(renderer, 'serializeModel');
      vi.spyOn(renderer, 'serializeCollection');
      vi.spyOn(renderer, '_renderHtml');
    });


    describe('when object has no model or collection', function() {
      beforeEach(function() {
        renderer.render();
      });

      it('should not serialize the model', function() {
        expect(renderer.serializeModel).not.toHaveBeenCalled();
      });

      it('should not serialize the collection', function() {
        expect(renderer.serializeCollection).not.toHaveBeenCalled();
      });

      it('should send an empty object to the renderer', function() {
        expect(renderer._renderHtml).toHaveBeenCalledTimes(1);
        expect(renderer._renderHtml.mock.calls.map(args => args.slice(0, 2))).toContainEqual([renderer.template, {}]);
      });
    });

    describe('when object has a model', function() {
      beforeEach(function() {
        renderer.model = model;
        renderer.render();
      });

      it('should serialize the model', function() {
        expect(renderer.serializeModel).toHaveBeenCalledTimes(1);
      });

      it('should not serialize the collection', function() {
        expect(renderer.serializeCollection).not.toHaveBeenCalled();
      });

      it('should send the model attributes to the renderer', function() {
        expect(renderer._renderHtml).toHaveBeenCalledTimes(1);
        expect(renderer._renderHtml.mock.calls.map(args => args.slice(0, 2))).toContainEqual([renderer.template, { foo: 'data' }]);
      });
    });

    describe('when object has only a collection', function() {
      beforeEach(function() {
        renderer.collection = collection;
        renderer.render();
      });

      it('should not serialize the model', function() {
        expect(renderer.serializeModel).not.toHaveBeenCalled();
      });

      it('should serialize the collection', function() {
        expect(renderer.serializeCollection).toHaveBeenCalledTimes(1);
      });

      it('should send collection data on the `models` template property', function() {
        renderer.template = vi.fn();
        renderer.render();

        expect(renderer.template).toHaveBeenCalledTimes(1);
        expect(renderer.template.mock.calls.map(args => args.slice(0, 1))).toContainEqual([{ models: [{ id: 1 },{ id: 2 }] }]);
        expect(renderer.template.mock.calls.at(0)[0]).to.not.have.property('items');
      });

      it('wraps an overridden serialized collection under models', function() {
        const serialized = { custom: true };
        renderer.serializeCollection = vi.fn().mockReturnValue(serialized);
        renderer.template = vi.fn();

        renderer.render();

        expect(renderer.template).toHaveBeenCalledTimes(1);
        expect(renderer.template.mock.calls.map(args => args.slice(0, 1))).toContainEqual([{ models: serialized }]);
      });

      it('preserves model order and attribute object identity', function() {
        const serialized = renderer.serializeCollection();

        expect(serialized).to.not.equal(collection.models);
        expect(serialized).to.have.lengthOf(collection.models.length);
        collection.models.forEach((collectionModel, index) => {
          expect(serialized[index]).to.equal(collectionModel.attributes);
        });
      });

      it('reads attributes in order and stops on an error', function() {
        const calls = [];
        const error = new Error('attributes failed');
        const [first, second] = collection.models;
        const firstAttributes = first.attributes;
        Object.defineProperty(first, 'attributes', {
          configurable: true,
          get() {
            calls.push('first');
            return firstAttributes;
          }
        });
        Object.defineProperty(second, 'attributes', {
          configurable: true,
          get() {
            calls.push('second');
            throw error;
          }
        });

        expect(() => renderer.serializeCollection()).to.throw(error);
        expect(calls).to.deep.equal(['first', 'second']);
      });
    });

    describe('when object has both model and collection', function() {
      beforeEach(function() {
        renderer.model = model;
        renderer.collection = collection;
        renderer.render();
      });

      it('should serialize the model', function() {
        expect(renderer.serializeModel).toHaveBeenCalledTimes(1);
      });

      it('should not serialize the collection', function() {
        expect(renderer.serializeCollection).not.toHaveBeenCalled();
      });
    });
  });

  describe('when attaching content', function() {
    it('should call the DOM Mixin', function() {
      renderer.el = 'fooEl';
      renderer._renderHtml = _.constant('html');
      renderer.render();

      expect(renderer.Dom.setContents).toHaveBeenCalledTimes(1);
      expect(renderer.Dom.setContents).toHaveBeenCalledWith('fooEl', 'html');
    });
  })
});
