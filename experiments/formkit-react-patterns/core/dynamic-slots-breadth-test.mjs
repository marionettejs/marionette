import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const dom = new JSDOM('<body><main></main>');
for (const key of ['window','document','Node','Element','HTMLElement','HTMLInputElement','HTMLFormElement','Event','CustomEvent','MutationObserver','getComputedStyle'])globalThis[key] = dom.window[key];
const {mount} = await import('./index.mjs');
const host = document.querySelector('main'),pause = ()=>new Promise(resolve=>setTimeout(resolve,40));
let created = 0,destroyed = 0;
const api = mount({host,fields: [{name: 'text',label: 'Original',help: 'Original help'},{name: 'repeat',type: 'repeatSlot',value: ['A','B']}],inputs: {
  repeatSlot: {type: 'input',schema: {$el: 'section',children: {$el: 'span',for: ['row','$_value'],children: {if: '$slots.item',then: '$slots.item'}}}},
},components: {Badge: ({host,props})=>{created++;const el = document.createElement('b');el.textContent = props.text;host.append(el);return {destroy() {destroyed++;}};}}});
const badge = text=>({$cmp: 'Badge',props: {text}});
try {
  await pause();const textNode = api.node.at('text'),repeatNode = api.node.at('repeat'),input = host.querySelector('input');
  await textNode.input('edited');await pause();
  api.setFields([{name: 'text',label: 'Original',help: 'Original help',children: {label: badge('New label'),help: {$el: 'em',children: 'New help'}}},{name: 'repeat',type: 'repeatSlot',children: {item: badge('$row')}}]);await pause();
  assert.equal(host.querySelector('input'),input);assert.equal(api.node.at('text'),textNode);assert.equal(textNode.value,'edited');
  assert.equal(host.querySelector('em').textContent,'New help');
  assert.deepEqual([...host.querySelectorAll('b')].map(el=>el.textContent),['New label','A','B']);
  api.setFields([{name: 'text',label: 'Original',help: 'Original help',children: {label: badge('Replacement')}},{name: 'repeat',type: 'repeatSlot',children: {item: badge('$row + \' updated\'')}}]);await pause();
  assert.equal(host.querySelector('em'),null);
  assert.deepEqual([...host.querySelectorAll('b')].map(el=>el.textContent),['Replacement','A updated','B updated']);
  assert.equal(destroyed,3,'every instance of the replaced named slot is disposed');
  api.setFields([{name: 'text',label: 'Original',help: 'Original help'},{name: 'repeat',type: 'repeatSlot'}]);await pause();
  assert.equal(host.querySelectorAll('b').length,0);assert.equal(host.querySelector('label').textContent,'Original');
  assert.equal(created,destroyed);assert.equal(api.node.at('repeat'),repeatNode);
  api.setFields([{name: 'text',label: 'Original',children: {label: badge('Re-added')}},{name: 'repeat',type: 'repeatSlot',children: {item: badge('$row')}}]);await pause();
  assert.deepEqual([...host.querySelectorAll('b')].map(el=>el.textContent),['Re-added','A','B']);
  assert.equal(host.querySelector('input'),input);assert.equal(input.value,'edited');
} finally {api.destroy();}
assert.equal(created,destroyed);assert.equal(host.childNodes.length,0);dom.window.close();
console.log('dynamic named slots: add, replace every repeated instance, remove, re-add, retained DOM/Core/value and component teardown passed');
