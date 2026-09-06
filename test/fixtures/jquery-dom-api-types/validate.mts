import withJQuery from '@marionette/adapters/dom/jquery-view';
import { Behavior, View, CollectionView, createMarionette, setDomApi } from 'marionette';
import JQueryDomApi from '@marionette/adapters/dom/jquery';

const host = document.createElement('div');
const fragment = document.createDocumentFragment();
const result: JQuery<HTMLElement> = JQueryDomApi.findEl(host, '.child');
const JQueryView = withJQuery(View);
const wrapped: JQuery<Element> = new JQueryView({ el: host }).$el;

JQueryDomApi.detachEl(host);
JQueryDomApi.setContents(host, '<span>child</span>');
JQueryDomApi.appendContents(host, fragment);
JQueryDomApi.appendContents(host, '<span>child</span>');
JQueryDomApi.appendContents(host, wrapped);
JQueryDomApi.appendContents(host, [document.createElement('span')]);
// @ts-expect-error Appended collections must contain DOM nodes.
JQueryDomApi.appendContents(host, [1]);
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
const isolatedWrapped: JQuery<Element> = new (withJQuery(runtime.View))().$el;
// @ts-expect-error Configured DOM queries must contain elements, not numbers.
setDomApi({ ...JQueryDomApi, findEl() { return [1]; } });

const Extended = JQueryView.extend({
  label: 'item',
  initialize(options: { model: { label: string } }) { this.$el.addClass(this.label); },
  activate() { this.$el.addClass('active'); return this; }
}, { kind: 'jquery' });
const extended = new Extended({ model: { label: 'typed' } });
const query: JQuery<Element> = extended.$('button');
const modelLabel: string = extended.options.model.label;
const staticKind: string = Extended.kind;
extended.activate().$el.attr('title', 'active');
const JQueryList = withJQuery(CollectionView).extend({ childView: Extended });
new JQueryList({ collection: [] }).$el.addClass('list');
const JQueryBehavior = withJQuery(Behavior).extend({
  initialize(options: object) { this.$el.addClass('behavior'); }
});
new JQueryBehavior({}, extended).$el.addClass('initialized');
// @ts-expect-error Native views do not provide $el.
new View().$el;
// @ts-expect-error The wrapper follows el and cannot be replaced independently.
extended.$el = wrapped;

const Configured = View.extend({
  initialize(options: { label: string }) { this.options.label.toUpperCase(); },
  getLabel() { return this.options.label; }
}, { category: 'configured' });
const WrappedConfigured = withJQuery(Configured);
const configuredInstance = new WrappedConfigured({ label: 'preserved' });
const preservedLabel: string = configuredInstance.getLabel();
const preservedCategory: string = WrappedConfigured.category;
// @ts-expect-error The helper preserves required constructor options.
new WrappedConfigured();
