import {JSDOM} from 'jsdom';
export const dom = new JSDOM('<!doctype html><html><body></body></html>', {url: 'https://example.test/'});
for (const key of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'SVGElement', 'DocumentFragment', 'ShadowRoot', 'CustomEvent', 'Event', 'MouseEvent', 'customElements', 'MutationObserver']) {
  globalThis[key] = dom.window[key];
}
export const tick = () => new Promise(resolve => setTimeout(resolve, 0));
export function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return {promise, resolve};
}
