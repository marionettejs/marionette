'use strict';

var $ = require('jquery');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var $__default = /*#__PURE__*/_interopDefaultLegacy($);

var jqueryDomApi = {
  // Finds the `selector` string within the el
  // Returns a jQuery collection
  findEl(el, selector) {
    return $__default['default'](el).find(selector);
  },

  // Detach `el` from the DOM without removing listeners
  detachEl(el) {
    $__default['default'](el).detach();
  },

  // Replace the contents of `el` with the `html`
  setContents(el, html) {
    $__default['default'](el).html(html);
  },

  // Takes the DOM node `el` and appends the DOM node `contents`
  // to the end of the element's contents.
  appendContents(el, contents) {
    $__default['default'](el).append(contents);
  },

  // Remove the inner contents of `el` from the DOM while leaving
  // `el` itself in the DOM.
  detachContents(el) {
    $__default['default'](el).contents().detach();
  }

};

module.exports = jqueryDomApi;
