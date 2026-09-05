import { View, CollectionView, createMarionette, setDomApi } from 'marionette';
import JQueryDomApi = require('@marionette/adapters/dom/jquery');

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

// Configure the installed root and isolated runtimes with the real DOM adapter.
setDomApi(JQueryDomApi);
const runtime = createMarionette();
runtime.setDomApi(JQueryDomApi);
View.setDomApi(JQueryDomApi);
runtime.CollectionView.setDomApi(JQueryDomApi);
const item = new View({ el: host, template: false, model: { label: 'jQuery' } });
const label: string = item.options.model.label;
const itemElement: Element = item.el;
const itemQuery: JQuery<HTMLElement> = JQueryDomApi.findEl(itemElement, '.child');
const list = new CollectionView({ collection: [{ label: 'jQuery' }], childView: View });
const isolatedItem = new runtime.View({ template: false });
const isolatedList = new runtime.CollectionView({ collection: [], childView: runtime.View });
JQueryDomApi.wrapEl(isolatedItem.el);
// @ts-expect-error Configured DOM queries must contain elements, not numbers.
setDomApi({ ...JQueryDomApi, findEl() { return [1]; } });
