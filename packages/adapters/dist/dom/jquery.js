import $ from 'jquery';

var jquery = {
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
  },
  wrapEl(el) {
    return $(el);
  }
};

export { jquery as default };
