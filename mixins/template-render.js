import { map, result, extend } from 'underscore';

// MixinOptions
// - template
// - templateContext

export default {

  // Internal method to render the template with the serialized data
  // and template context
  _renderTemplate(template) {
    // Add in entity data and template context
    const data = this.mixinTemplateContext(this.serializeData()) || {};

    // Render and add to el
    const html = this._renderHtml(template, data);
    if (typeof html !== 'undefined') {
      this.attachElContent(html);
    }
  },

  // Get the template for this view instance.
  // You can set a `template` attribute in the view definition
  // or pass a `template: TemplateFunction` parameter in
  // to the constructor options.
  getTemplate() {
    return this.template;
  },

  // Mix in template context methods. Looks for a
  // `templateContext` attribute, which can either be an
  // object literal, or a function that returns an object
  // literal. All methods and attributes from this object
  // are copies to the object passed in.
  mixinTemplateContext(serializedData) {
    const templateContext = result(this, 'templateContext');
    if (!templateContext) { return serializedData; }
    if (!serializedData) { return templateContext; }
    return extend({}, serializedData, templateContext);
  },

  // Serialize the view's model *or* collection, if
  // it exists, for the template
  serializeData() {
    // If we have a model, we serialize that
    if (this.model) {
      return this.serializeModel();
    }

    // Otherwise, we serialize the collection,
    // making it available under the `items` property
    if (this.collection) {
      return {
        items: this.serializeCollection()
      };
    }
  },

  // Prepares the special `model` property of a view
  // for being displayed in the template. Override this if
  // you need a custom transformation for your view's model
  serializeModel() {
    return this.model.attributes;
  },

  // Serialize a collection
  serializeCollection() {
    return map(this.collection.models, model => model.attributes);
  },

  // Renders the data into the template
  _renderHtml(template, data) {
    return template(data);
  },

  // Attaches the content of a given view.
  // This method can be overridden to optimize rendering,
  // or to render in a non standard way.
  //
  // For example, using `innerHTML` instead of `$el.html`
  //
  // ```js
  // attachElContent(html) {
  //   this.el.innerHTML = html;
  // }
  // ```
  attachElContent(html) {
    this.Dom.setContents(this.el, html);
  }
};
