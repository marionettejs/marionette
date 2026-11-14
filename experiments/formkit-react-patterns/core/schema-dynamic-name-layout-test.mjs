import assert from 'node:assert/strict';
import {setupProjectionDom,mountProjectionReference,settle} from './schema-projection-reference.mjs';
const dom = setupProjectionDom(),arm = process.argv[2] ?? 'experiment',host = document.querySelector('main');
const schema = [{$formkit: 'group',name: 'g',children: [{$el: 'section',children: [{$formkit: 'text',name: '$left',label: '$title'},{$formkit: 'text',name: '$right',label: '$title'},{$formkit: 'text',label: 'Static anonymous'}]}]}];
const app = await mountProjectionReference(arm,host,schema,{title: 'Initial'});
try {
  const group = app.node.at('g'),nodes = [...group.children],inputs = [...host.querySelectorAll('input')];assert.equal(nodes.length,3);assert.equal(inputs.length,3);assert.equal(new Set(nodes.map(n=>n.name)).size,3);assert.ok(nodes.every(n=>typeof n.name === 'string' && n.name));
  await nodes[0].input('left edit');await nodes[1].input('right edit');await settle();await app.update({title: 'Updated'});
  assert.deepEqual(group.children,nodes);assert.deepEqual([...host.querySelectorAll('input')],inputs);assert.equal(inputs[0].value,'left edit');assert.equal(inputs[1].value,'right edit');assert.equal(host.querySelector('label').textContent,'Updated');
} finally {app.destroy();await settle();assert.equal(app.counts().created,app.counts().destroyed);assert.equal(host.childNodes.length,0);}
const unnamedGroup = await mountProjectionReference(arm,host,[{$formkit: 'group',name: '$groupName',children: [{$el: 'section',children: [{$formkit: 'text',name: 'child',label: '$title'}]}]}],{title: 'Anonymous group'});
try {
  const group = unnamedGroup.node.children[0],child = group.children[0],input = host.querySelector('input');assert.equal(unnamedGroup.node.children.length,1);assert.equal(group.type,'group');assert.ok(group.name);assert.equal(child.name,'child');await child.input('nested edit');await settle();await unnamedGroup.update({title: 'Group retained'});assert.equal(unnamedGroup.node.children[0],group);assert.equal(group.children[0],child);assert.equal(host.querySelector('input'),input);assert.equal(input.value,'nested edit');
} finally {unnamedGroup.destroy();await settle();assert.equal(unnamedGroup.counts().created,unnamedGroup.counts().destroyed);assert.equal(host.childNodes.length,0);}
// Adding the private identity must preserve lazy/non-enumerable declaration props.
const descriptor = Object.defineProperty({$cmp: 'FormKit',props: {type: 'group',name: 'declared'}},'children',{value: [{$el: 'section',children: [{$formkit: 'text',name: 'child'}]}],enumerable: false});
const described = await mountProjectionReference(arm,host,[descriptor]);
try {assert.ok(described.node.at('declared.child'));assert.equal(host.querySelectorAll('section input').length,1);} finally {described.destroy();await settle();assert.equal(described.counts().created,described.counts().destroyed);assert.equal(host.childNodes.length,0);}
// A key changing with the resolved name requests the same remount in all peers.
const renamed = await mountProjectionReference(arm,host,[{$formkit: 'group',name: 'g',children: [{$el: 'section',children: [{$formkit: 'text',name: '$childName',key: '$childName',label: '$title'}]}]}],{childName: 'first',title: 'First'});
try {
  const group = renamed.node.at('g'),first = renamed.node.at('g.first'),input = host.querySelector('input');await first.input('edited');await settle();await renamed.update({childName: 'first',title: 'Retained'});assert.equal(renamed.node.at('g.first'),first);assert.equal(host.querySelector('input'),input);assert.equal(input.value,'edited');
  await renamed.update({childName: 'second',title: 'Changed'});const second = renamed.node.at('g.second');assert.ok(second);assert.notEqual(second,first);assert.equal(first.context == null,true);assert.equal(renamed.node.at('g.first'),undefined);assert.equal(group.children.length,1);assert.equal(second.value,undefined);assert.notEqual(host.querySelector('input'),input);
  await renamed.update({title: 'Anonymous'});const anonymous = group.children[0],anonymousInput = host.querySelector('input');assert.equal(group.children.length,1);assert.equal(renamed.node.at('g.second'),undefined);assert.equal(second.context == null,true);assert.ok(anonymous.name);await anonymous.input('anonymous edit');await settle();await renamed.update({title: 'Anonymous retained'});assert.equal(group.children[0],anonymous);assert.equal(host.querySelector('input'),anonymousInput);assert.equal(anonymousInput.value,'anonymous edit');
} finally {renamed.destroy();await settle();assert.equal(renamed.counts().created,renamed.counts().destroyed);assert.equal(host.childNodes.length,0);dom.window.close();}
console.log(JSON.stringify({arm,passed: true,checks: ['multiple unresolved dynamic names','static anonymous sibling','declaration descriptors preserved','unresolved native group name','generated Core names','anonymous Core/DOM/edit identity','resolved and changed keyed names','resolved-to-anonymous transition','exact node teardown']}));
