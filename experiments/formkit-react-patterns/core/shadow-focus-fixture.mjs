import {mount} from './index.mjs';
import {getNode} from '@formkit/core';
const check = (test,message)=>{if (!test) {throw new Error(message);}},settle = ()=>new Promise(resolve=>setTimeout(resolve,20));
export async function runShadowFocus(host,mode) {
  const shadow = host.attachShadow({mode: 'open'}),outlet = document.createElement('section');shadow.append(outlet);let created = 0,destroyed = 0;
  const capture = n=>{created++;n.on('destroyed',()=>destroyed++);},spec = name=>({type: 'text',name,label: name});
  const schema = {$el: 'section',for: ['row','$rows'],attrs: {key: '$row','data-row': '$row'},children: [{$formkit: 'text',name: '$row',key: '$row'}]};
  const api = mount({host: outlet,...(mode === 'direct' ? {fields: ['a','b','c'].map(spec)} : {schema,data: {rows: ['a','b','c']}}),plugins: [capture],config: {delay: 0},formProps: {actions: false}});
  let passed = false;
  try {
    await settle();const node = api.node.at('b'),input = shadow.querySelector('input[name=b]');await node.input('Edited b');await settle();input.focus();check(shadow.activeElement === input,'precondition: inner input focuses');
    if (mode === 'direct') {api.setFields(['c','b','a'].map(spec));} else {api.updateData({rows: ['c','b','a']});} await settle();
    check(shadow.activeElement === input,mode + ': retained inner focus survives reorder');check(api.node.at('b') === node,'Core owner retained');check(shadow.querySelector('input[name=b]') === input,'DOM retained');check(input.value === 'Edited b','edit retained');check([...shadow.querySelectorAll('input')].map(n=>n.name).join(',') === 'c,b,a','requested order');check(getNode(input.id) === node,'registry owner retained');passed = true;
  } finally {api.destroy();await settle();check(created === destroyed,'exact created/destroyed counts');check(outlet.childElementCount === 0,'DOM cleared');}
  return {passed,mode,created,destroyed};
}
