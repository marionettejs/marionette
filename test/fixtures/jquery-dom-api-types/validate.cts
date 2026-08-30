import JQueryDomApi = require('marionette/jquery-dom-api');

const host = document.createElement('div');
const fragment = document.createDocumentFragment();
const result: JQuery<HTMLElement> = JQueryDomApi.findEl(host, '.child');
const wrapped: JQuery<HTMLElement> = JQueryDomApi.wrapEl(host);

JQueryDomApi.detachEl(host);
JQueryDomApi.setContents(host, '<span>child</span>');
JQueryDomApi.appendContents(host, fragment);
JQueryDomApi.appendContents(host, '<span>child</span>');
JQueryDomApi.detachContents(host);

// @ts-expect-error findEl returns a jQuery collection, not a DOM element.
const element: Element = JQueryDomApi.findEl(host, '.child');
// @ts-expect-error A selector must be a string.
JQueryDomApi.findEl(host, 1);
// @ts-expect-error The adapter does not expose arbitrary jQuery methods.
JQueryDomApi.addClass('active');

void result;
void wrapped;
void element;
