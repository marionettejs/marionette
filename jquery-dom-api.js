import $ from 'jquery';

export default {
  // Finds the `selector` string within the el
  // Returns a jQuery collection
  findEl(el, selector) {
    return $(el).find(selector);
  },

  // Detach `el` from the DOM without removing listeners
  detachEl(el) {
    $(el).detach();
  },

  // Replace the contents of `el` with the `html`
  setContents(el, html) {
    $(el).html(html);
  },

  // Takes the DOM node `el` and appends the DOM node `contents`
  // to the end of the element's contents.
  appendContents(el, contents) {
    $(el).append(contents);
  },

  // Remove the inner contents of `el` from the DOM while leaving
  // `el` itself in the DOM.
  detachContents(el) {
    $(el).contents().detach();
  }
};
