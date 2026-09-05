import { assignOwn } from '../utils/assign-in.js';
import getValue from '../utils/get-value.ts';

import type { DataApi } from '../runtime/data-api.ts';
import type { DomApi } from '../runtime/dom-api.ts';
import type { Renderer } from '../runtime/renderer.ts';

export interface TemplateHost {
  el: Element;
  template?: unknown;
  templateContext?: unknown;
  model?: unknown;
  collection?: unknown;
  Data: Partial<DataApi>;
  Dom: Partial<DomApi>;
  serializeData(): unknown;
  serializeModel(): unknown;
  serializeCollection(): unknown[];
  mixinTemplateContext(data: unknown): unknown;
  _renderHtml?: Renderer<never, never, never>;
  attachElContent(html: unknown): void;
}

// MixinOptions
// - template
// - templateContext

export default {

  // Internal method to render the template with the serialized data
  // and template context
  _renderTemplate(this: TemplateHost, template: unknown) {
    // Add in entity data and template context
    const data = this.mixinTemplateContext(this.serializeData()) || {};

    // Render and add to el
    const html = (this._renderHtml as Renderer<TemplateHost, unknown, unknown>)(template, data);
    if (typeof html !== 'undefined') {
      this.attachElContent(html);
    }
  },

  // Get the template for this view instance.
  // You can set a `template` attribute in the view definition
  // or pass a `template: TemplateFunction` parameter in
  // to the constructor options.
  getTemplate(this: TemplateHost) {
    return this.template;
  },

  // Mix in template context methods. Looks for a
  // `templateContext` attribute, which can either be an
  // object literal, or a function that returns an object
  // literal. All methods and attributes from this object
  // are copies to the object passed in.
  mixinTemplateContext(this: TemplateHost, serializedData: unknown) {
    const templateContext = getValue(this, 'templateContext');
    if (!templateContext) { return serializedData; }
    if (!serializedData) { return templateContext; }
    return assignOwn({}, serializedData, templateContext);
  },

  // Serialize the view's model *or* collection, if
  // it exists, for the template
  serializeData(this: TemplateHost) {
    // If we have a model, we serialize that
    if (this.model) {
      return this.serializeModel();
    }

    // Otherwise, we serialize the collection,
    // making it available under the `models` property
    if (this.collection) {
      return {
        models: this.serializeCollection()
      };
    }
  },

  // Prepares the special `model` property of a view
  // for being displayed in the template. Override this if
  // you need a custom transformation for your view's model
  serializeModel(this: TemplateHost) {
    return (this.Data.serialize as (model: unknown) => unknown)(this.model);
  },

  // Serialize a collection
  serializeCollection(this: TemplateHost) {
    return (this.Data.models as (collection: unknown) => readonly unknown[])(this.collection).map(model =>
      (this.Data.serialize as (model: unknown) => unknown)(model));
  },

  // Renders the data into the template
  _renderHtml<Data, Output>(template: (this: void, data: Data) => Output, data: Data): Output {
    return template(data);
  },

  // Attaches the content of a given view.
  // This method can be overridden to optimize rendering,
  // or to render in a non standard way.
  attachElContent(this: TemplateHost, html: unknown) {
    (this.Dom.setContents as (el: Element, contents: unknown) => void)(this.el, html);
  }
};
