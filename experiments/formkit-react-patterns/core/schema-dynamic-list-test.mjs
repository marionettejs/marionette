import assert from 'node:assert/strict';
import {setupProjectionDom,settle,mountProjectionReference} from './schema-projection-reference.mjs';
const dom = setupProjectionDom(),arm = process.argv[2] ?? 'experiment',surface = process.argv[4] ?? 'document',initialEmpty = process.argv[5] === 'empty';let host = document.querySelector('main');if (surface === 'shadow')host = host.attachShadow({mode: 'open'}).appendChild(document.createElement('article'));
const {reset,getNode,isNode} = await import('@formkit/core');
const source = {$formkit: 'list',name: 'rows',dynamic: true,value: initialEmpty ? ['Alpha',''] : ['Alpha','Beta'],children: [{$el: 'article',for: ['item','index','$items'],attrs: {key: '$item','data-row': '$index'},children: [{$el: 'span',children: '$caption'},{$formkit: 'text',index: '$index',key: '$item',validation: 'required'}]}]};
const schema = process.argv[3] === 'literal' ? {$cmp: 'FormKit',props: {type: 'list',name: source.name,dynamic: true,value: source.value},children: source.children} : source;
let api;
try {
  api = await mountProjectionReference(arm,host,schema,{caption: 'Row'});
  const list = api.node.at('rows'),inputs = ()=>[...host.querySelectorAll('article input')];
  assert.equal(inputs().length,2,'native dynamic list exposes default-slot $items');assert.deepEqual(inputs().map(n=>n.value),initialEmpty ? ['Alpha',''] : ['Alpha','Beta']);assert.deepEqual(api.node.value,{rows: initialEmpty ? ['Alpha',''] : ['Alpha','Beta']});assert.equal(list.children.length,2);assert.ok(list.children.every(isNode),'row placeholders become actual validating Core nodes');assert.equal(api.counts().created,4,'form, list and two actual fields only');
  const first = list.children[0],second = list.children[1],firstInput = inputs()[0],secondInput = inputs()[1];
  if (initialEmpty) {assert.equal(api.node.context.state.valid,false,'initial empty row installs its required validator');await api.submit();assert.equal(api.counts().invalid,1);assert.equal(api.counts().submitted,0);await second.input('Beta');await settle();assert.equal(api.node.context.state.valid,true);}
  await first.input('Edited');await settle();assert.equal(firstInput.value,'Edited');
  await api.update({caption: 'Updated',items: []});assert.equal(inputs()[0],firstInput);assert.equal(list.children[0],first);assert.equal(host.querySelector('span').textContent,'Updated');
  await list.input(['Beta','Edited','Added']);await settle();assert.equal(inputs().length,3);assert.deepEqual(inputs().map(n=>n.value),['Beta','Edited','Added']);assert.equal(list.children[0],second);assert.equal(list.children[1],first);assert.equal(inputs()[0],secondInput);assert.equal(inputs()[1],firstInput);
  const added = list.children[2];await added.input('');await settle();assert.equal(api.node.context.state.valid,false);await api.submit();assert.equal(api.counts().invalid,initialEmpty ? 2 : 1);assert.equal(api.counts().submitted,0);
  await list.input(['Beta','Edited']);await settle();assert.equal(inputs().length,2);assert.equal(added.context == null,true);assert.equal(api.node.context.state.valid,true);await api.submit();assert.equal(api.counts().submitted,1);assert.equal(api.counts().created,5);
  reset(api.node,{rows: ['Reset A','Reset B']});await settle();assert.deepEqual(api.node.value,{rows: ['Reset A','Reset B']});assert.equal(inputs().length,2);
  await list.input([]);await settle();assert.equal(inputs().length,0);assert.deepEqual(api.node.value,{rows: []});await list.input(['Again']);await settle();assert.equal(inputs().length,1);assert.equal(inputs()[0].value,'Again');
  const ids = api.nodes.map(n=>n.props.id);api.destroy();await settle();assert.equal(api.counts().created,api.counts().destroyed);assert.equal(host.childElementCount,0);for (const id of ids)assert.equal(getNode(id),undefined);
  console.log(JSON.stringify({arm,surface,initialEmpty,passed: true,...api.counts(),checks: ['native default slot $items beats external data','dynamic list ownership/value topology','data update retains edits/Core/DOM','append/reorder/remove preserves item identity','required submit blocking and removal','reset/empty/readd','exact cleanup']}));
} finally {api?.destroy();dom.window.close();}
