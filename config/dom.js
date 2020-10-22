// DomApi
//  ---------
import { extend, each, keys } from 'underscore';

// Static setter
export function setDomApi(mixin) {
  this.prototype.Dom = extend({}, this.prototype.Dom, mixin);
  return this;
}

export default {
  // Returns a new HTML DOM node of tagName
  createElement(tagName) {
    return document.createElement(tagName);
  },

  // Returns a new HTML DOM node instance
  createBuffer() {
    return document.createDocumentFragment();
  },

  // Returns the document element for a given DOM element
  getDocumentEl(el) {
    return el.ownerDocument.documentElement;
  },

  // Finds the `selector` string with the el
  // Returns an array-like object of nodes
  findEl(el, selector) {
    return el.querySelectorAll(selector);
  },

  // Returns true if the el contains the node childEl
  hasEl(el, childEl) {
    return el.contains(childEl && childEl.parentNode);
  },

  // Detach `el` from the DOM without removing listeners
  detachEl(el) {
    if (el.parentNode) {el.parentNode.removeChild(el);}
  },

  // Remove `oldEl` from the DOM and put `newEl` in its place
  replaceEl(newEl, oldEl) {
    if (newEl === oldEl) {
      return;
    }

    const parent = oldEl.parentNode;

    if (!parent) {
      return;
    }

    parent.replaceChild(newEl, oldEl);
  },

  // Swaps the location of `el1` and `el2` in the DOM
  swapEl(el1, el2) {
    if (el1 === el2) {
      return;
    }

    const parent1 = el1.parentNode;
    const parent2 = el2.parentNode;

    if (!parent1 || !parent2) {
      return;
    }

    const next1 = el1.nextSibling;
    const next2 = el2.nextSibling;

    parent1.insertBefore(el2, next1);
    parent2.insertBefore(el1, next2);
  },

  // Replace the contents of `el` with the `html`
  setContents(el, html) {
    el.innerHTML = html
  },

  // Sets attributes on a DOM node
  setAttributes(el, attrs) {
    each(keys(attrs), attr => {
      attr in el ? el[attr] = attrs[attr] : el.setAttribute(attr, attrs[attr]);
    });
  },

  // Takes the DOM node `el` and appends the DOM node `contents`
  // to the end of the element's contents.
  appendContents(el, contents) {
    el.appendChild(contents);
  },

  // Does the el have child nodes
  hasContents(el) {
    return !!el && el.hasChildNodes();
  },

  // Remove the inner contents of `el` from the DOM while leaving
  // `el` itself in the DOM.
  detachContents(el) {
    el.textContent = '';
  }
};
