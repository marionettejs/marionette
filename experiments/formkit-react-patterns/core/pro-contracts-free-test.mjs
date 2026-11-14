// Exercise the shared contracts required by Pro without importing licensed inputs.
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const dom = new JSDOM('<body><main></main>');
for (const key of ['window','document','Node','Element','HTMLElement','HTMLInputElement','HTMLFormElement','Event','CustomEvent','MutationObserver','getComputedStyle'])globalThis[key] = dom.window[key];
const {mount} = await import('./index.mjs');
const pause = ()=>new Promise(resolve=>setTimeout(resolve,40));
const nodes = [],destroyed = new Map();
const capture = node=>{nodes.push(node);node.on('destroyed',()=>destroyed.set(node,(destroyed.get(node) ?? 0) + 1));};
const host = document.querySelector('main');
const fields = [
  {type: 'composite',name: 'outer',value: {kept: 'original'}},
  {type: 'rows',name: 'rows',value: [{label: 'first'},{label: 'second'}],children: {default: {$formkit: 'text',name: 'label',label: '$row.label'}}},
  {type: 'group',name: 'nativeGroup',children: [{name: 'text',value: 'group value'}]},
  {type: 'list',name: 'nativeList',children: [{value: 'list value'}]},
];
const api = mount({host,plugins: [capture],fields,inputs: {
  composite: {type: 'group',schema: {$el: 'section',attrs: {'data-composite': true},children: [
    {$formkit: 'text',name: 'kept'},
    {$formkit: 'number',name: 'detached',ignore: true,value: 7},
  ]}},
  rows: {type: 'list',schema: {$el: 'section',attrs: {'data-rows': true},children: {
    $formkit: 'group',for: ['row','index','$_value'],index: '$index',sync: true,children: '$slots.default',
  }}},
}});
try {
  await pause();
  const outer = api.node.at('outer');
  assert.deepEqual(outer.children.map(node=>node.name),['kept']);
  assert.deepEqual(outer.value,{kept: 'original'});
  const detached = nodes.find(node=>node.name === 'detached');
  assert.ok(detached);assert.equal(detached.parent,null);
  const ignoredInput = host.querySelector('[data-composite] input[type="number"]');
  assert.equal(ignoredInput.value,'7');
  ignoredInput.value = '9';ignoredInput.dispatchEvent(new Event('input',{bubbles: true}));await pause();
  assert.equal(detached.value,'9');assert.deepEqual(outer.value,{kept: 'original'});
  const rows = api.node.at('rows');
  assert.equal(rows.children.length,2);
  assert.deepEqual([...host.querySelectorAll('[data-rows] label')].map(el=>el.textContent),['first','second']);
  const inputs = [...host.querySelectorAll('[data-rows] input')];
  assert.deepEqual(inputs.map(el=>el.value),['first','second']);
  assert.equal(rows.children[0].children[0].parent,rows.children[0]);
  assert.equal(rows.children[1].children[0].parent,rows.children[1]);
  inputs[1].value = 'edited';inputs[1].dispatchEvent(new Event('input',{bubbles: true}));await pause();
  assert.deepEqual(rows.value,[{label: 'first'},{label: 'edited'}]);
  assert.equal(host.querySelectorAll('[data-rows] input')[1],inputs[1]);
  assert.deepEqual(api.node.at('nativeGroup').value,{text: 'group value'});
  assert.deepEqual(api.node.at('nativeList').value,['list value']);
  api.form.setFields(fields.filter(field=>field.name !== 'outer'));await pause();
  assert.equal(destroyed.get(detached),1);assert.equal(destroyed.get(outer),1);
} finally {api.destroy();}
assert.equal(host.childNodes.length,0);
assert.equal(destroyed.size,nodes.length);
assert.ok([...destroyed.values()].every(count=>count === 1),'all scoped and ignored nodes destroyed once');
dom.window.close();
console.log('free contracts: ignored parentage, named list slots/loop scope, nested group ownership, native group/list arrays and exact-once teardown passed');
