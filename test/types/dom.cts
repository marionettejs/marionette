import nativeDom, {setDomApi, type DomApi} from '../tmp/typed-core/src/runtime/dom-api.js';
import nativeDelegator, {setEventDelegator, type EventDelegator} from '../tmp/typed-core/src/runtime/event-delegator.js';
import {setRenderer, type Renderer} from '../tmp/typed-core/src/runtime/renderer.js';

const el: HTMLElement = nativeDom.createElement('button');
const fragment: DocumentFragment = nativeDom.createBuffer();
const matches: NodeListOf<Element> = nativeDom.findEl(fragment, 'button');
const documentRoot: Element | null = nativeDom.getDocumentEl(el);
const hasEl: boolean = nativeDom.hasEl(el, undefined);
const hasContents: boolean = nativeDom.hasContents(null);
const appended: void = nativeDom.appendContents(el, fragment);
nativeDom.setContents(el, '<b>contents</b>');
nativeDom.setAttributes(el, {disabled: true, tabIndex: 0, title: null});
nativeDom.setAttributes(el, Object.assign(() => {}, {title: 'callable map'}));
for (const ignored of [undefined, null, false, true, 0, 1, 0n, 1n, '', 'ignored', Symbol()] as const) {
  nativeDom.setAttributes(el, ignored);
}
nativeDom.moveEl(el, fragment);
nativeDom.moveEl(el, fragment, null);
// @ts-expect-error Native append takes DOM nodes, not HTML strings.
nativeDom.appendContents(el, '<b>contents</b>');
// @ts-expect-error Native queries return NodeList, not mutable arrays.
const array: Element[] = matches;
// @ts-expect-error Query roots have native querySelectorAll.
nativeDom.findEl('#root', 'button');
// @ts-expect-error The native adapter does not provide a wrapper.
nativeDom.wrapEl(el);

const DomClass = {prototype: {Dom: nativeDom}, setDomApi, label: 'dom class'};
const sameDomClass: typeof DomClass = DomClass.setDomApi({findEl(root, selector) {return root.querySelectorAll(selector);}});
DomClass.setDomApi({setContents(root, html: string) {root.innerHTML = html;}});
DomClass.setDomApi({setContents(root, contents: Node) {root.appendChild(contents);}});
DomClass.setDomApi({wrapEl(root) {return {node: root};}});
DomClass.setDomApi({findEl: undefined});
DomClass.setDomApi({metadata: true});
DomClass.setDomApi(Object.assign(() => {}, {metadata: true}));
DomClass.setDomApi();
for (const ignored of [undefined, null, false, true, 0, 1, 0n, 1n, '', 'ignored', Symbol()] as const) {
  DomClass.setDomApi(ignored);
}
// @ts-expect-error Queries return an array-like collection of Elements.
DomClass.setDomApi({findEl() {return {};}});
// @ts-expect-error Query items must be DOM elements.
DomClass.setDomApi({findEl() {return ['text'];}});
// @ts-expect-error Creation returns a DOM element.
DomClass.setDomApi({createElement() {return 'div';}});
// @ts-expect-error A DOM operation must be callable.
DomClass.setDomApi({detachEl: true});
declare const configured: Partial<DomApi>;
if (configured.findEl) {
  const result: ArrayLike<Element> = configured.findEl(el, 'button');
}
if (configured.setContents) {
  // @ts-expect-error Registration alone does not establish the content/renderer match.
  configured.setContents(el, 'content');
}
declare const explicitDom: DomApi<NodeListOf<Element>, {node: Element}, string>;
explicitDom.setContents(el, 'content');
explicitDom.findEl(el, 'button').forEach(node => node.remove());
const wrapper: {node: Element} | undefined = explicitDom.wrapEl?.(el);

const cleanup: () => void = nativeDelegator.delegate({eventName: 'click', rootEl: el, handler(event) {
  event.delegateTarget?.matches('button');
  return false;
}});
nativeDelegator.delegate({eventName: 'focus', rootEl: el, selector: null, handler() {}});
// @ts-expect-error A root is a native Element, not a selector.
nativeDelegator.delegate({eventName: 'click', rootEl: '#root', handler() {}});
// @ts-expect-error Native events are not numbers.
nativeDelegator.delegate({eventName: 'click', rootEl: el, handler(event: number) {return event;}});
// @ts-expect-error The low-level callback does not promise a View receiver.
nativeDelegator.delegate({eventName: 'click', rootEl: el, handler(this: {viewName: string}) {return this.viewName;}});
const DelegatorClass = {prototype: {}, setEventDelegator, label: 'delegator class'};
const sameDelegatorClass: typeof DelegatorClass = DelegatorClass.setEventDelegator(nativeDelegator);
const custom: EventDelegator = {delegate({rootEl, handler}) {handler(rootEl, 'extra'); return () => {};}};
DelegatorClass.setEventDelegator(custom);
// @ts-expect-error Delegate must return a cleanup function.
DelegatorClass.setEventDelegator({delegate() {return 3;}});
// @ts-expect-error An adapter is complete, not a partial overlay.
DelegatorClass.setEventDelegator({});
// @ts-expect-error Null is rejected by the runtime setter.
DelegatorClass.setEventDelegator(null);

const RendererClass = {prototype: {}, setRenderer, label: 'renderer class'};
const renderer: Renderer<{el: Element}, string, {name: string}, void> = function(template, data) {
  this.el.textContent = template + data.name;
};
const sameRendererClass: typeof RendererClass = RendererClass.setRenderer(renderer);
RendererClass.setRenderer();
RendererClass.setRenderer(() => null);
RendererClass.setRenderer(() => false);
RendererClass.setRenderer(() => el);
// @ts-expect-error Renderers are callable.
RendererClass.setRenderer('template');
// @ts-expect-error An explicitly declared renderer retains its receiver contract.
renderer.call({unrelated: true}, 'template', {name: 'Example'});
// @ts-expect-error An explicitly declared renderer retains its data contract.
renderer.call({el}, 'template', {count: 1});
setRenderer.call(RendererClass, renderer);
setDomApi.call(DomClass, nativeDom);
setEventDelegator.call(DelegatorClass, nativeDelegator);

// Setters can initialize ordinary class prototypes before an adapter exists.
class Fresh { el = document.createElement('div'); }
setDomApi.call(Fresh, nativeDom);
setRenderer.call(Fresh, renderer);
setEventDelegator.call(Fresh, {delegate() {return () => {};}, metadata: true});
