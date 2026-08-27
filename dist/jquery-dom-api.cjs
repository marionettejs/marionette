'use strict';

var $ = require('jquery');

var jqueryDomApi = {
  findEl(el, selector) {
    return $(el).find(selector);
  },
  detachEl(el) {
    $(el).detach();
  },
  setContents(el, html) {
    $(el).html(html);
  },
  appendContents(el, contents) {
    $(el).append(contents);
  },
  detachContents(el) {
    $(el).contents().detach();
  }
};

module.exports = jqueryDomApi;
