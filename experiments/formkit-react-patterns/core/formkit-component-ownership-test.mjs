import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
const dom = new JSDOM('<body><main></main>');for (const key of ['window','document','Node','Element','HTMLElement','HTMLInputElement','HTMLFormElement','Event','CustomEvent','MutationObserver','getComputedStyle']) {globalThis[key] = dom.window[key];}
const {mount} = await import('./index.mjs');const host = document.querySelector('main'),pause = ()=>new Promise(resolve=>setTimeout(resolve,35));
const cases = [
  {$cmp: 'FormKit',props: {type: 'group',name: 'profile'},children: [{$formkit: 'text',name: 'name',value: 'Ada'}]},
  {$formkit: 'group',name: 'profile',children: [{$el: 'section',children: {$cmp: 'FormKit',props: {type: 'list',name: 'names'},children: [{$el: 'ol',children: {$el: 'li',children: {$formkit: 'text',name: 0,value: 'Ada'}}}]}}]},
  {$cmp: 'FormKit',props: {type: 'group',name: 'profile'},children: [{$el: 'section',children: {$formkit: 'list',name: 'names',children: [{$el: 'ol',children: {$el: 'li',children: {$formkit: 'text',name: 0,value: 'Ada'}}}]}}]}
];
for (let i = 0;i < cases.length;i++) {
  const nodes = [],dead = new Set();const api = mount({host,schema: cases[i],plugins: [node=>{nodes.push(node);node.on('destroyed',()=>{assert.ok(!dead.has(node));dead.add(node);});}]});
  try {await pause();assert.equal(api.node.children.length,1);const profile = api.node.at('profile');if (!i) {assert.equal(api.node.at('profile.name').parent,profile);assert.deepEqual(api.node.value,{profile: {name: 'Ada'}});} else {const list = api.node.at('profile.names');assert.equal(list.parent,profile);assert.equal(list.children[0].parent,list);assert.deepEqual(api.node.value,{profile: {names: ['Ada']}});} const input = host.querySelector('input');input.value = 'Edited';input.dispatchEvent(new Event('input',{bubbles: true}));await pause();assert.equal(i ? api.node.at('profile.names').children[0].value : api.node.at('profile.name').value,'Edited');api.updateData({unrelated: true});await pause();assert.equal(host.querySelector('input'),input);} finally {api.destroy();}
  assert.equal(dead.size,nodes.length);assert.equal(host.childNodes.length,0);
}
dom.window.close();console.log('explicit FormKit component Core ownership: group children and both inverse mixed group/list compositions, input/update identity and exact cleanup passed');
