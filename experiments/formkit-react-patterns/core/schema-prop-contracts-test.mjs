import assert from 'node:assert/strict';import {createNode} from '@formkit/core';import {createSchemaController} from './schema.mjs';
const node = createNode({type: 'group'});let fields;
const schema = {$formkit: 'text',bind: '$props',label: {if: '$enabled',then: '$title',else: 'Disabled'},attrs: {title: {if: '$enabled',then: 'On',else: 'Off'},'__raw__data-literal': '$keep'},inputClass: '$reset my-input',help: '$'};
const data = {enabled: true,title: 'Explicit',props: {name: 'bound',label: 'Ignored',placeholder: 'Bound placeholder',custom: '$notAnExpression'}};
const c = createSchemaController({node,schema,data,onFields: f=>fields = f});
assert.equal(fields[0].name,'bound');assert.equal(fields[0].label,'Explicit');assert.equal(fields[0].placeholder,'Bound placeholder');assert.equal(fields[0].custom,'$notAnExpression');assert.equal(fields[0].attrs.title,'On');assert.equal(fields[0].attrs['data-literal'],'$keep');assert.equal(fields[0].inputClass,'$reset my-input');assert.equal(fields[0].help,'$');
c.updateData({...data,enabled: false});assert.equal(fields[0].label,'Disabled');assert.equal(fields[0].attrs.title,'Off');c.destroy();node.destroy();console.log('schema bind precedence, conditional props, nested raw values, class reset and literal dollar passed');
