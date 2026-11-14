import assert from 'node:assert/strict';
import { createNode } from '@formkit/core';
import { createSchemaController } from './schema.mjs';
const node = createNode({ type: 'group', value: { enabled: true }, props: { delay: 0 } });
let fields;
const schema = [
  { $formkit: '$kind', name: 'custom', label: '$title', customProp: '$format($title)', __raw__validation: '$literal' },
  { $formkit: 'text', for: ['item', 'index', '$items'], name: '$item.name', label: '$item.label', attrs: { 'data-index': '$index' } },
  { if: '$values.enabled', then: { $formkit: 'group', name: 'details', children: [{ $formkit: 'text', name: 'detail' }] } },
  { if: '$missing', then: { $formkit: 'text', name: 'notShown' }, else: { $formkit: 'text', name: 'fallback' } }
];
const data = { kind: 'customInput', title: 'Hello', format: x => x.toUpperCase(), items: [{name: 'a',label: 'A'}, {name: 'b',label: 'B'}] };
const controller = createSchemaController({ node, schema, data, onFields: next => { fields = next; } });
assert.equal(fields[0].type, 'customInput'); assert.equal(fields[0].customProp, 'HELLO'); assert.equal(fields[0].validation, '$literal');
assert.deepEqual(fields.slice(1,3).map(f=>f.name), ['a','b']); assert.equal(fields[2].attrs['data-index'],1);
assert.equal(fields[3].children[0].name, 'detail'); assert.equal(fields[4].name,'fallback');
controller.updateData({...data, items: [{name: 'c',label: 'C'}]}); assert.equal(fields[1].name,'c');
await node.input({enabled: false}); await new Promise(r=>setTimeout(r,0)); assert.ok(!fields.some(f=>f.name === 'details'));
controller.destroy(); node.destroy();
const numericNode = createNode({type: 'group'}); let numeric;
const numericController = createSchemaController({node: numericNode,schema: {$formkit: 'text',for: ['i',3],name: '$i'},onFields: f=>numeric = f});
assert.deepEqual(numeric.map(f=>f.name),['0','1','2']); numericController.destroy(); numericNode.destroy();
console.log('schema breadth: dynamic types/names/props, function data, raw values, loops, conditional groups, updateData and reactive node values passed');
