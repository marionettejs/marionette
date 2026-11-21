// Shared public mounting apparatus for the projection regression peer fixtures.
import {JSDOM} from 'jsdom';
export function setupProjectionDom() {
  const dom = new JSDOM('<body><main></main>',{url: 'http://localhost'});
  for (const key of ['window','document','Document','ShadowRoot','Node','Element','HTMLElement','SVGElement','HTMLInputElement','HTMLFormElement','Event','CustomEvent','MutationObserver','getComputedStyle']) {globalThis[key] = dom.window[key];}
  Object.defineProperty(globalThis,'navigator',{value: dom.window.navigator,configurable: true});
  return dom;
}
export const settle = ()=>new Promise(resolve=>setTimeout(resolve,20));
export async function mountProjectionReference(arm, host, schema, data = {}) {
  if (arm !== 'experiment') {throw new Error('Package lifetime guard uses the actual built package');}
  const {mount} = await import(process.env.FORMKIT_LIFETIME_ENTRY ?? new URL('../../dist/index.js', import.meta.url).href);
  let node, created = 0, destroyed = 0, submitted = 0, invalid = 0;
  const nodes = [], capture = value => {created++; nodes.push(value); value.on('destroyed', () => destroyed++);};
  const api = mount({host, schema, data, plugins: [capture], config: {delay: 0}, formProps: {actions: false}, onSubmit: () => submitted++, onSubmitInvalid: () => invalid++});
  node = api.node;
  await settle();
  return {node, nodes, counts: () => ({created, destroyed, submitted, invalid}), destroy: () => api.destroy(), async update(next) {api.updateData(next); await settle();}, async submit() {host.querySelector('form').dispatchEvent(new Event('submit', {bubbles: true, cancelable: true})); await settle();}};
}
