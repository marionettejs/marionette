import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
const dom = new JSDOM('<body><main></main>');for (const key of ['window','document','Node','Element','HTMLElement','HTMLInputElement','HTMLFormElement','Event','CustomEvent','MutationObserver','getComputedStyle']) {globalThis[key] = dom.window[key];}
const {mount} = await import('./index.mjs'),{getNode} = await import('@formkit/core');const host = document.querySelector('main'),pause = ()=>new Promise(resolve=>setTimeout(resolve,15));
let components = 0,disposed = 0;
const panel = ({host: componentHost,renderChildren})=>{components++;const el = document.createElement('section');componentHost.append(el);renderChildren(el);return {destroy(remove = true) {disposed++;if (remove) {el.remove();}}};};
for (let round = 0;round < 12;round++) {
  const nodes = [],dead = new Set(),pending = [];let inputCalls = 0;
  const api = mount({host,instrument: true,plugins: [node=>{nodes.push(node);node.on('destroyed',()=>{assert.ok(!dead.has(node),'exactly once');dead.add(node);});}],rules: {slow: ()=>new Promise(resolve=>pending.push(resolve))},schema: [{$formkit: 'text',name: 'async',validation: 'slow',onInput: ()=>inputCalls++},{$formkit: 'group',name: 'profile',children: [{$formkit: 'text',name: 'name'}]}],values: {async: 'pending',profile: {name: 'Ada'}},slots: {default: {$cmp: 'Panel',children: '$slots.fields'}},components: {Panel: panel}});
  await pause();const ids = nodes.map(node=>node.props.id);assert.ok(pending.length);const input = host.querySelector('input[name=async]');input.value = 'late';input.dispatchEvent(new Event('input',{bubbles: true}));api.destroy();const callbacks = inputCalls,metrics = {...api.metrics};
  for (const release of pending) {release(false);} await pause();await pause();assert.equal(inputCalls,callbacks);assert.deepEqual(api.metrics,metrics);assert.equal(dead.size,nodes.length);for (const id of ids) {assert.equal(getNode(id),undefined);}assert.equal(host.childNodes.length,0);
  api.updateData({late: true});api.setSchema({$formkit: 'text',name: 'late'});api.setFields([{name: 'late'}]);assert.equal(host.childNodes.length,0);
}
assert.equal(components,12);assert.equal(disposed,12);dom.window.close();console.log('12 repeated mixed-schema mount/unmount cycles: pending validation/input, component and Core disposal, registry removal and inert terminal API passed');
